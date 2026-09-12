import { NetworkMessage } from '../types/game';

type SendSignalFn = (message: NetworkMessage) => void;
type SpeakingChangeCb = (speakingPlayerIds: Set<string>) => void;
type ErrorCb = (errorMessage: string) => void;

const clientEnv = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env || {};

const configuredTurnUrls = (clientEnv.VITE_TURN_URLS || clientEnv.VITE_TURN_URL || '')
  .split(',')
  .map(url => url.trim())
  .filter(Boolean);

// Metered's Free plan uses the standard relay endpoint. These URLs are only
// used when credentials are present; direct host/STUN candidates remain the
// preferred ICE candidates and TURN is selected automatically when direct
// connectivity fails.
const meteredTurnUrls = [
  'turn:standard.relay.metered.ca:80',
  'turn:standard.relay.metered.ca:80?transport=tcp',
  'turn:standard.relay.metered.ca:443',
  'turns:standard.relay.metered.ca:443?transport=tcp'
];

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' }
];

// STUN cannot cross every NAT/firewall combination. Production deployments
// should provide short-lived TURN credentials through Vite env variables:
// VITE_TURN_URLS, VITE_TURN_USERNAME, and VITE_TURN_CREDENTIAL.
const turnUrls = configuredTurnUrls.length > 0 ? configuredTurnUrls : (
  clientEnv.VITE_TURN_USERNAME && clientEnv.VITE_TURN_CREDENTIAL ? meteredTurnUrls : []
);

if (turnUrls.length > 0 && clientEnv.VITE_TURN_USERNAME && clientEnv.VITE_TURN_CREDENTIAL) {
  ICE_SERVERS.push({
    urls: turnUrls,
    username: clientEnv.VITE_TURN_USERNAME,
    credential: clientEnv.VITE_TURN_CREDENTIAL
  });
}

const MEDIUM_AUDIO_BITRATE = 32_000;

export class VoiceChatManager {
  private myPlayerId: string | null = null;
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private sendSignal: SendSignalFn | null = null;
  private onSpeakingChangeCb: SpeakingChangeCb | null = null;
  private onErrorCb: ErrorCb | null = null;

  private isPushToTalkActive: boolean = false;
  private speakingPlayerIds: Set<string> = new Set();
  private isInitializingMic: boolean = false;
  private micPermissionDenied: boolean = false;
  private audioUnlockHandler: (() => void) | null = null;

  public init(myPlayerId: string, sendSignal: SendSignalFn) {
    this.myPlayerId = myPlayerId;
    this.sendSignal = sendSignal;

    // A remote WebRTC track can arrive outside the original click/keypress
    // that started voice chat. Retry any blocked audio elements on the next
    // user gesture so browser autoplay policy cannot leave voice permanently
    // silent after a successful connection.
    if (typeof window !== 'undefined' && !this.audioUnlockHandler) {
      this.audioUnlockHandler = () => {
        for (const audio of this.remoteAudioElements.values()) {
          void audio.play().catch(() => {});
        }
      };
      window.addEventListener('pointerdown', this.audioUnlockHandler);
      window.addEventListener('keydown', this.audioUnlockHandler);
    }
  }

  public setCallbacks(onSpeakingChange: SpeakingChangeCb, onError?: ErrorCb) {
    this.onSpeakingChangeCb = onSpeakingChange;
    this.onErrorCb = onError || null;
  }

  /**
   * Acquire local microphone stream if not already obtained.
   * Keeps audio track muted (enabled = false) until user explicitly talks.
   */
  public async ensureLocalStream(): Promise<MediaStream | null> {
    if (this.localStream) return this.localStream;
    if (this.micPermissionDenied) return null;
    if (this.isInitializingMic) return null;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      if (this.onErrorCb) this.onErrorCb('Voice chat is not supported on this browser/device.');
      return null;
    }

    try {
      this.isInitializingMic = true;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16_000
        },
        video: false
      });

      // Mute by default until push-to-talk is engaged
      stream.getAudioTracks().forEach(track => {
        track.enabled = this.isPushToTalkActive;
      });

      this.localStream = stream;

      // Update all existing RTCPeerConnections with this track
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        for (const pc of this.peerConnections.values()) {
          // createPeerConnection() creates an audio transceiver before the
          // user presses Push to Talk. Its sender has no track yet, so do
          // not look only at sender.track; use the existing audio sender and
          // replace its track. Adding a second audio track here would create
          // an un-negotiated m-line, which means remote peers never receive
          // the microphone in the deployed/WebSocket path.
          const audioSender = pc.getTransceivers()
            .find(transceiver => transceiver.receiver.track.kind === 'audio')
            ?.sender;
          if (audioSender) {
            audioSender.replaceTrack(audioTrack).catch(() => {});
            this.configureAudioSender(audioSender);
          } else {
            try {
              const sender = pc.addTrack(audioTrack, stream);
              this.configureAudioSender(sender);
            } catch (e) {}
          }
        }
      }

      this.isInitializingMic = false;
      return stream;
    } catch (err: any) {
      this.isInitializingMic = false;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.micPermissionDenied = true;
        if (this.onErrorCb) {
          this.onErrorCb('Microphone access was denied. Enable microphone in browser settings to speak.');
        }
      } else {
        console.warn('[VoiceChat] Could not get user media:', err);
      }
      return null;
    }
  }

  /**
   * Sync active players list to establish WebRTC peer connections.
   */
  public syncPlayers(playerIds: string[]) {
    if (!this.myPlayerId) return;

    const currentPeers = new Set(playerIds.filter(id => id !== this.myPlayerId));

    // Close removed peers
    for (const [peerId, pc] of this.peerConnections.entries()) {
      if (!currentPeers.has(peerId)) {
        try { pc.close(); } catch (e) {}
        this.peerConnections.delete(peerId);
        this.removeRemoteAudio(peerId);
        this.speakingPlayerIds.delete(peerId);
      }
    }

    // Connect to new peers
    for (const peerId of currentPeers) {
      if (!this.peerConnections.has(peerId)) {
        this.createPeerConnection(peerId);
      }
    }

    if (this.onSpeakingChangeCb) {
      this.onSpeakingChangeCb(new Set(this.speakingPlayerIds));
    }
  }

  private createPeerConnection(remotePlayerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.peerConnections.set(remotePlayerId, pc);

    // Add audio transceiver or track
    if (this.localStream && this.localStream.getAudioTracks()[0]) {
      try {
        pc.addTrack(this.localStream.getAudioTracks()[0], this.localStream);
      } catch (e) {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      }
    } else {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && this.sendSignal && this.myPlayerId) {
        this.sendSignal({
          type: 'VOICE_SIGNAL',
          fromPlayerId: this.myPlayerId,
          toPlayerId: remotePlayerId,
          data: { type: 'candidate', candidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      // A track added through an existing transceiver may arrive without a
      // MediaStream in event.streams. Do not discard it: create a stream from
      // the received track so the remote audio element can play it.
      const remoteStream = event.streams?.[0] || new MediaStream([event.track]);
      this.attachRemoteAudio(remotePlayerId, remoteStream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn('[VoiceChat] Media connection', pc.connectionState, 'for peer', remotePlayerId,
          '— configure a TURN server for players on different networks.');
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.speakingPlayerIds.delete(remotePlayerId);
        if (this.onSpeakingChangeCb) {
          this.onSpeakingChangeCb(new Set(this.speakingPlayerIds));
        }
      }
    };

    // If our ID is lexicographically smaller, initiate the offer
    if (this.myPlayerId && this.myPlayerId < remotePlayerId) {
      this.initiateOffer(remotePlayerId, pc);
    }

    return pc;
  }

  private async initiateOffer(remotePlayerId: string, pc: RTCPeerConnection) {
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true
      });
      await pc.setLocalDescription(offer);

      if (this.sendSignal && this.myPlayerId) {
        this.sendSignal({
          type: 'VOICE_SIGNAL',
          fromPlayerId: this.myPlayerId,
          toPlayerId: remotePlayerId,
          data: { type: 'offer', sdp: pc.localDescription }
        });
      }
    } catch (e) {
      console.warn('[VoiceChat] Error initiating offer to', remotePlayerId, e);
    }
  }

  /**
   * Handle incoming WebRTC signaling message.
   */
  public async handleVoiceSignal(fromPlayerId: string, data: any) {
    if (!this.myPlayerId || !data) return;

    let pc = this.peerConnections.get(fromPlayerId);
    if (!pc) {
      pc = this.createPeerConnection(fromPlayerId);
    }

    try {
      if (data.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

        // Drain any pending ICE candidates queued before remote description was set
        const pending = this.pendingCandidates.get(fromPlayerId) || [];
        for (const cand of pending) {
          try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) {}
        }
        this.pendingCandidates.delete(fromPlayerId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (this.sendSignal) {
          this.sendSignal({
            type: 'VOICE_SIGNAL',
            fromPlayerId: this.myPlayerId,
            toPlayerId: fromPlayerId,
            data: { type: 'answer', sdp: pc.localDescription }
          });
        }
      } else if (data.type === 'answer') {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

          const pending = this.pendingCandidates.get(fromPlayerId) || [];
          for (const cand of pending) {
            try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) {}
          }
          this.pendingCandidates.delete(fromPlayerId);
        }
      } else if (data.type === 'candidate' && data.candidate) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {}
        } else {
          // Queue candidate until remote description arrives
          const list = this.pendingCandidates.get(fromPlayerId) || [];
          list.push(data.candidate);
          this.pendingCandidates.set(fromPlayerId, list);
        }
      }
    } catch (e) {
      console.warn('[VoiceChat] Error handling signal from', fromPlayerId, e);
    }
  }

  /**
   * Handle incoming VOICE_SPEAKING notifications.
   */
  public handleVoiceSpeaking(playerId: string, isSpeaking: boolean) {
    if (isSpeaking) {
      this.speakingPlayerIds.add(playerId);
    } else {
      this.speakingPlayerIds.delete(playerId);
    }
    if (this.onSpeakingChangeCb) {
      this.onSpeakingChangeCb(new Set(this.speakingPlayerIds));
    }
  }

  /**
   * Push-to-Talk: Start Speaking (Microphone Enabled)
   */
  public async startTalking() {
    if (this.isPushToTalkActive) return;
    this.isPushToTalkActive = true;

    // Ensure mic stream is initialized
    const stream = await this.ensureLocalStream();
    if (!stream) {
      // Permission failures should not leave the UI broadcasting a speaking
      // state when there is no local audio track to send.
      this.isPushToTalkActive = false;
      return;
    }

    stream.getAudioTracks().forEach(track => {
      track.enabled = true;
    });

    if (this.myPlayerId) {
      this.speakingPlayerIds.add(this.myPlayerId);
      if (this.onSpeakingChangeCb) {
        this.onSpeakingChangeCb(new Set(this.speakingPlayerIds));
      }

      if (this.sendSignal) {
        this.sendSignal({
          type: 'VOICE_SPEAKING',
          playerId: this.myPlayerId,
          isSpeaking: true
        });
      }
    }
  }

  /**
   * Push-to-Talk: Stop Speaking (Microphone Muted)
   */
  public stopTalking() {
    if (!this.isPushToTalkActive) return;
    this.isPushToTalkActive = false;

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
    }

    if (this.myPlayerId) {
      this.speakingPlayerIds.delete(this.myPlayerId);
      if (this.onSpeakingChangeCb) {
        this.onSpeakingChangeCb(new Set(this.speakingPlayerIds));
      }

      if (this.sendSignal) {
        this.sendSignal({
          type: 'VOICE_SPEAKING',
          playerId: this.myPlayerId,
          isSpeaking: false
        });
      }
    }
  }

  public get isTalking(): boolean {
    return this.isPushToTalkActive;
  }

  public get activeSpeakers(): Set<string> {
    return new Set(this.speakingPlayerIds);
  }

  private attachRemoteAudio(peerId: string, stream: MediaStream) {
    let audio = this.remoteAudioElements.get(peerId);
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', 'true');
      audio.style.display = 'none';
      document.body.appendChild(audio);
      this.remoteAudioElements.set(peerId, audio);
    }
    audio.srcObject = stream;
    audio.play().catch(() => {
      // Auto-play policy catch: user interaction will resume playback
    });
  }

  private configureAudioSender(sender: RTCRtpSender) {
    const parameters = sender.getParameters();
    if (!parameters.encodings || parameters.encodings.length === 0) {
      parameters.encodings = [{}];
    }
    for (const encoding of parameters.encodings) {
      encoding.maxBitrate = MEDIUM_AUDIO_BITRATE;
    }
    void sender.setParameters(parameters).catch(() => {});
  }

  private removeRemoteAudio(peerId: string) {
    const audio = this.remoteAudioElements.get(peerId);
    if (audio) {
      try {
        audio.srcObject = null;
        audio.remove();
      } catch (e) {}
      this.remoteAudioElements.delete(peerId);
    }
  }

  /**
   * Destroy and clean up all audio and WebRTC connections.
   */
  public destroy() {
    this.stopTalking();

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }

    for (const pc of this.peerConnections.values()) {
      try { pc.close(); } catch (e) {}
    }
    this.peerConnections.clear();

    for (const audio of this.remoteAudioElements.values()) {
      try {
        audio.srcObject = null;
        audio.remove();
      } catch (e) {}
    }
    this.remoteAudioElements.clear();

    this.pendingCandidates.clear();
    this.speakingPlayerIds.clear();
    if (this.audioUnlockHandler && typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.audioUnlockHandler);
      window.removeEventListener('keydown', this.audioUnlockHandler);
      this.audioUnlockHandler = null;
    }
    this.myPlayerId = null;
    this.sendSignal = null;
    this.onSpeakingChangeCb = null;
    this.onErrorCb = null;
  }
}

export const voiceChatManager = new VoiceChatManager();
