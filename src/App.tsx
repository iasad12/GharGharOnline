import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Player, PlayerColor, GameMode, GridConfig, LanRoomInfo } from './types/game';
import {
  GRID_PRESETS,
  PLAYER_COLORS,
  getFirstLetter,
  createInitialGameState,
  applyMove
} from './logic/gameEngine';
import { getBestBotMove } from './logic/botAI';
import { peerManager, PeerManager } from './network/peerManager';
import { sound } from './logic/audio';
import { Header } from './components/Header';
import { Lobby } from './components/Lobby';
import { ClaimedHomeBadge } from './components/ClaimedHomeBadge';
import { GameBoard } from './components/GameBoard';
import { PlayerBar } from './components/PlayerBar';
import { GameOverModal } from './components/GameOverModal';
import { RulesModal } from './components/RulesModal';
import { InviteProfileModal } from './components/InviteProfileModal';
import { voiceChatManager } from './network/voiceChat';
import { RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';

// Helper to check if player has customized their profile
function hasCustomizedProfile(): boolean {
  try {
    const isSet = localStorage.getItem('ghar_ghar_profile_set') === 'true';
    const storedName = localStorage.getItem('ghar_ghar_name');
    return isSet && !!storedName && storedName.trim() !== '' && storedName !== 'Player 1' && storedName !== 'Player 2';
  } catch (e) {
    return false;
  }
}

// Helper to generate clean 6-char room code
function generateRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = 'GHAR-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const App: React.FC = () => {
  // User Profile
  const [myPlayerName, setMyPlayerName] = useState(() => {
    return localStorage.getItem('ghar_ghar_name') || 'Player 1';
  });
  const [myColor, setMyColor] = useState<PlayerColor>(() => {
    return (localStorage.getItem('ghar_ghar_color') as PlayerColor) || PLAYER_COLORS[0];
  });
  const [myPlayerId, setMyPlayerId] = useState<string>(() => {
    let id: string | null = null;
    try {
      id = sessionStorage.getItem('ghar_ghar_session_id');
    } catch (e) {}
    if (!id) {
      id = 'user_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      try {
        sessionStorage.setItem('ghar_ghar_session_id', id);
      } catch (e) {}
    }
    return id;
  });

  // Dark Mode
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('ghar_ghar_dark') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('ghar_ghar_dark', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Game Settings & State
  const [gameMode, setGameMode] = useState<GameMode>('multiplayer');
  const [selectedGrid, setSelectedGrid] = useState<GridConfig>(GRID_PRESETS[1]); // Classic Phone default
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [isWaitingInRoom, setIsWaitingInRoom] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<Player[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lanRooms, setLanRooms] = useState<LanRoomInfo[]>([]);

  // Modals & Approval System
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [showQrModalInGame, setShowQrModalInGame] = useState(false);
  const [inGameQrUrl, setInGameQrUrl] = useState<string | null>(null);
  const [pendingJoinRequest, setPendingJoinRequest] = useState<{
    id: string;
    name: string;
    color: PlayerColor;
  } | null>(null);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);

  // Invite Profile Prompt
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [pendingInviteRoom, setPendingInviteRoom] = useState<string | null>(null);

  // Voice Chat State
  const [speakingPlayerIds, setSpeakingPlayerIds] = useState<Set<string>>(new Set());
  const [isTalking, setIsTalking] = useState<boolean>(false);

  // References to keep callbacks immune to stale React closures
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;

  const lobbyPlayersRef = useRef(lobbyPlayers);
  lobbyPlayersRef.current = lobbyPlayers;

  const myPlayerIdRef = useRef(myPlayerId);
  myPlayerIdRef.current = myPlayerId;

  const myPlayerNameRef = useRef(myPlayerName);
  myPlayerNameRef.current = myPlayerName;

  const myColorRef = useRef(myColor);
  myColorRef.current = myColor;

  const selectedGridRef = useRef(selectedGrid);
  selectedGridRef.current = selectedGrid;

  const roomCodeRef = useRef(roomCode);
  roomCodeRef.current = roomCode;

  const stateRef = useRef<GameState | null>(gameState);
  stateRef.current = gameState;

  const joinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist name & color changes
  useEffect(() => {
    localStorage.setItem('ghar_ghar_name', myPlayerName);
    if (myPlayerName && myPlayerName.trim() !== '' && myPlayerName !== 'Player 1' && myPlayerName !== 'Player 2') {
      try {
        localStorage.setItem('ghar_ghar_profile_set', 'true');
      } catch (e) {}
    }
  }, [myPlayerName]);

  useEffect(() => {
    localStorage.setItem('ghar_ghar_color', myColor);
  }, [myColor]);

  // Voice Chat Manager initialization & callbacks
  useEffect(() => {
    voiceChatManager.init(myPlayerId, (msg) => {
      peerManager.broadcast(msg);
    });

    voiceChatManager.setCallbacks((speakers) => {
      setSpeakingPlayerIds(new Set(speakers));
      setIsTalking(speakers.has(myPlayerIdRef.current));
    });

    return () => {
      voiceChatManager.destroy();
    };
  }, [myPlayerId]);

  // Sync active players into VoiceChatManager mesh
  useEffect(() => {
    if (gameMode === 'multiplayer') {
      const activePlayers = gameState?.players && gameState.players.length > 0
        ? gameState.players
        : lobbyPlayers;
      if (activePlayers && activePlayers.length > 0) {
        voiceChatManager.syncPlayers(activePlayers.map(p => p.id));
      }
    }
  }, [gameState?.players, lobbyPlayers, gameMode]);

  // Periodic LAN room scanner (every 2.5s when not in an active game)
  useEffect(() => {
    // Once a player is in multiplayer, room discovery is no longer needed.
    // Keeping this request alive during a game needlessly consumes Pages
    // requests on every open client.
    if (gameMode === 'multiplayer' || gameState?.phase === 'playing') {
      return;
    }

    const fetchRooms = () => {
      PeerManager.fetchLanRooms().then(rooms => {
        setLanRooms(rooms);
      });
    };

    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [gameMode, gameState?.phase]);

  // Check URL query parameters for ?room=XYZ -> Prompt for name/color if unconfigured, or auto-join
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      const formattedCode = roomParam.trim().toUpperCase();
      setRoomCode(formattedCode);
      roomCodeRef.current = formattedCode;
      setGameMode('multiplayer');

      if (!hasCustomizedProfile()) {
        // Player has not yet set name/color: prompt them with the invite setup modal!
        setPendingInviteRoom(formattedCode);
        setShowInviteModal(true);
      } else {
        // Automatically join the room with brief timeout to ensure peerManager is initialized
        const timer = setTimeout(() => {
          handleJoinGame(formattedCode);
        }, 350);

        return () => clearTimeout(timer);
      }
    }
  }, []);

  // Cleanup room immediately on tab close, reload, or navigate away
  useEffect(() => {
    const handleUnload = () => {
      if (isHostRef.current && roomCodeRef.current) {
        const code = roomCodeRef.current;
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          navigator.sendBeacon(`/api/lan-rooms?roomId=${encodeURIComponent(code)}&action=delete`);
        }
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, []);

  // -------------------------------------------------------------
  // AI BOT TURN AUTOMATION (FOR VS_BOTS OR MULTIPLAYER WITH BOTS)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') return;

    const activePlayer = gameState.players[gameState.currentTurnIndex];
    if (activePlayer && activePlayer.isBot) {
      if (gameMode === 'multiplayer' && !isHost) return;

      const timer = setTimeout(() => {
        if (!stateRef.current) return;
        const botMoveEdgeId = getBestBotMove(stateRef.current);
        if (botMoveEdgeId) {
          executeMove(botMoveEdgeId, activePlayer.id);
        }
      }, 550);

      return () => clearTimeout(timer);
    }
  }, [gameState, isHost, gameMode]);

  // -------------------------------------------------------------
  // MULTIPLAYER NETWORKING EVENT HANDLER
  // -------------------------------------------------------------
  const handleNetworkMessage = (message: any, connectionId?: string) => {
    switch (message.type) {
      case 'JOIN_REQUEST': {
        // Only host processes join requests
        if (!isHostRef.current) return;
        const currentState = stateRef.current;
        if (!currentState) return;

        const currentPlayers = lobbyPlayersRef.current.length > 0
          ? lobbyPlayersRef.current
          : currentState.players;

        const incomingPlayerId = message.player.id || connectionId || `player_${Date.now()}`;
        const incomingName = (message.player.name || 'Player ' + (currentPlayers.length + 1)).trim();

        // Check if this exact player is already added by unique player ID
        const existingPlayer = currentPlayers.find(p => p.id === incomingPlayerId);

        if (existingPlayer) {
          // Re-send acceptance so client receives latest lobby state
          peerManager.broadcast({
            type: 'JOIN_ACCEPTED',
            state: currentState,
            assignedId: existingPlayer.id,
            targetPlayerId: incomingPlayerId
          });
          return;
        }

        if (currentPlayers.length >= 5) {
          peerManager.broadcast({
            type: 'JOIN_REJECTED',
            reason: 'Room is full (max 5 players).',
            targetPlayerId: incomingPlayerId
          });
          return;
        }

        // Auto-disambiguate names if two players have the exact same display name
        let resolvedName = incomingName;
        const existingNames = currentPlayers.map(p => p.name.trim().toLowerCase());
        if (existingNames.includes(resolvedName.toLowerCase())) {
          let counter = 2;
          while (existingNames.includes(`${incomingName} (${counter})`.toLowerCase())) {
            counter++;
          }
          resolvedName = `${incomingName} (${counter})`;
        }

        // Assign available color if requested is taken
        let assignedColor = message.player.color;
        const takenColors = currentPlayers.map(p => p.color);
        if (takenColors.includes(assignedColor)) {
          assignedColor = PLAYER_COLORS.find(c => !takenColors.includes(c)) || PLAYER_COLORS[0];
        }

        // If game is actively in progress (not in lobby), require Host approval
        if (currentState.phase !== 'lobby') {
          peerManager.broadcast({
            type: 'JOIN_PENDING_APPROVAL',
            targetPlayerId: incomingPlayerId
          });
          setPendingJoinRequest({
            id: incomingPlayerId,
            name: resolvedName,
            color: assignedColor
          });
          sound.playTurnNotification();
          return;
        }

        const newPlayer: Player = {
          id: incomingPlayerId,
          name: resolvedName,
          initial: getFirstLetter(resolvedName),
          color: assignedColor,
          score: 0,
          isHost: false,
          connected: true
        };

        const updatedPlayers = [...currentPlayers, newPlayer];
        setLobbyPlayers(updatedPlayers);
        lobbyPlayersRef.current = updatedPlayers;

        const updatedState = { ...currentState, players: updatedPlayers };
        setGameState(updatedState);
        stateRef.current = updatedState;

        // Broadcast acceptance to joining peer
        peerManager.broadcast({
          type: 'JOIN_ACCEPTED',
          state: updatedState,
          assignedId: newPlayer.id,
          targetPlayerId: incomingPlayerId
        });

        // Broadcast to all other peers
        peerManager.broadcast({
          type: 'PLAYER_JOINED',
          player: newPlayer
        });

        // Update LAN heartbeat with new player count immediately (lobby only)
        if (roomCodeRef.current && currentState.phase === 'lobby') {
          peerManager.startLanHeartbeat({
            roomId: roomCodeRef.current,
            hostName: myPlayerNameRef.current.trim() || 'Player 1',
            dotCols: selectedGridRef.current.dotCols,
            dotRows: selectedGridRef.current.dotRows,
            currentPlayers: updatedPlayers.length,
            maxPlayers: 5,
            status: 'waiting'
          });
        }
        break;
      }

      case 'JOIN_PENDING_APPROVAL': {
        if (!isHostRef.current) {
          if (message.targetPlayerId && message.targetPlayerId !== myPlayerIdRef.current) {
            return;
          }
          if (joinTimeoutRef.current) {
            clearTimeout(joinTimeoutRef.current);
            joinTimeoutRef.current = null;
          }
          peerManager.stopJoinRetry();
          setIsLoading(false);
          setIsWaitingForApproval(true);
        }
        break;
      }

      case 'JOIN_ACCEPTED': {
        // Only clients waiting to join should handle JOIN_ACCEPTED
        if (!isHostRef.current) {
          if (message.targetPlayerId && message.targetPlayerId !== myPlayerIdRef.current) {
            return; // Not for this client
          }
          if (joinTimeoutRef.current) {
            clearTimeout(joinTimeoutRef.current);
            joinTimeoutRef.current = null;
          }
          peerManager.stopJoinRetry();
          setIsLoading(false);
          setIsWaitingForApproval(false);
          setIsWaitingInRoom(message.state.phase === 'lobby');
          setErrorMessage(null);
          if (message.assignedId) setMyPlayerId(message.assignedId);
          setGameState(message.state);
          setLobbyPlayers(message.state.players);
          lobbyPlayersRef.current = message.state.players;
          setSelectedGrid(message.state.grid);
        }
        break;
      }

      case 'JOIN_REJECTED': {
        if (!isHostRef.current) {
          if (message.targetPlayerId && message.targetPlayerId !== myPlayerIdRef.current) {
            return;
          }
          if (joinTimeoutRef.current) {
            clearTimeout(joinTimeoutRef.current);
            joinTimeoutRef.current = null;
          }
          peerManager.stopJoinRetry();
          setIsLoading(false);
          setIsWaitingForApproval(false);
          setErrorMessage(message.reason || 'Failed to join room.');
        }
        break;
      }

      case 'PLAYER_JOINED': {
        setLobbyPlayers(prev => {
          if (prev.some(p => p.id === message.player.id)) return prev;
          const next = [...prev, message.player];
          lobbyPlayersRef.current = next;
          return next;
        });
        setGameState(prev => {
          if (!prev) return null;
          if (prev.players.some(p => p.id === message.player.id)) return prev;
          const next = { ...prev, players: [...prev.players, message.player] };
          stateRef.current = next;
          return next;
        });
        break;
      }

      case 'PLAYER_LEFT': {
        setPendingJoinRequest(prev => prev && prev.id === message.playerId ? null : prev);
        setLobbyPlayers(prev => {
          const next = prev.filter(p => p.id !== message.playerId);
          lobbyPlayersRef.current = next;
          return next;
        });
        setGameState(prev => {
          if (!prev) return null;
          const next = {
            ...prev,
            players: prev.players.map(p =>
              p.id === message.playerId ? { ...p, connected: false } : p
            )
          };
          stateRef.current = next;
          return next;
        });
        break;
      }

      case 'START_GAME': {
        setGameState(message.state);
        stateRef.current = message.state;
        setIsWaitingInRoom(false);
        break;
      }

      case 'MAKE_MOVE': {
        if (isHostRef.current && stateRef.current) {
          executeMove(message.edgeId, message.playerId);
        }
        break;
      }

      case 'SYNC_STATE': {
        const prevState = stateRef.current;
        const nextState = message.state as GameState;

        // Audio cues on state changes
        if (nextState.claimedBoxesCount > (prevState?.claimedBoxesCount || 0)) {
          sound.playBoxClaimed();
        } else {
          sound.playPencilScratch();
        }

        // If turn just arrived at me
        const prevActive = prevState?.players[prevState.currentTurnIndex]?.id;
        const nextActive = nextState.players[nextState.currentTurnIndex]?.id;
        if (nextActive === myPlayerIdRef.current && prevActive !== myPlayerIdRef.current) {
          sound.playTurnNotification();
        }

        if (nextState.phase === 'playing') {
          setIsWaitingInRoom(false);
        }

        setGameState(nextState);
        stateRef.current = nextState;
        break;
      }

      case 'REMATCH': {
        setGameState(message.state);
        stateRef.current = message.state;
        break;
      }

      case 'VOICE_SIGNAL': {
        if (message.toPlayerId === myPlayerIdRef.current) {
          voiceChatManager.handleVoiceSignal(message.fromPlayerId, message.data);
        }
        break;
      }

      case 'VOICE_SPEAKING': {
        voiceChatManager.handleVoiceSpeaking(message.playerId, message.isSpeaking);
        break;
      }
    }
  };

  // Wire up peerManager callback through a stable ref
  const handleNetworkMessageRef = useRef(handleNetworkMessage);
  handleNetworkMessageRef.current = handleNetworkMessage;

  useEffect(() => {
    peerManager.setCallbacks(
      (message, connectionId) => {
        if (handleNetworkMessageRef.current) {
          handleNetworkMessageRef.current(message, connectionId);
        }
      },
      (disconnectedPeerId) => {
        setLobbyPlayers(prev => {
          const next = prev.filter(p => p.id !== disconnectedPeerId);
          lobbyPlayersRef.current = next;
          return next;
        });
      }
    );
  }, []);

  // -------------------------------------------------------------
  // MOVE EXECUTION (CORE ENGINE COUPLING)
  // -------------------------------------------------------------
  const executeMove = (edgeId: string, playerId: string) => {
    const currentState = stateRef.current;
    if (!currentState || currentState.phase !== 'playing') return;

    const activePlayer = currentState.players[currentState.currentTurnIndex];
    if (activePlayer.id !== playerId) return;

    const { nextState, newlyClaimedCells } = applyMove(currentState, edgeId, playerId);

    if (newlyClaimedCells.length > 0) {
      sound.playBoxClaimed();
    } else {
      sound.playPencilScratch();
    }

    // Check if next turn is user
    const nextPlayer = nextState.players[nextState.currentTurnIndex];
    if (nextPlayer && nextPlayer.id === myPlayerId && activePlayer.id !== myPlayerId) {
      sound.playTurnNotification();
    }

    setGameState(nextState);

    // If multiplayer, broadcast to peers
    if (gameMode === 'multiplayer') {
      if (isHost) {
        peerManager.broadcast({
          type: 'SYNC_STATE',
          state: nextState
        });
      } else {
        peerManager.sendToHost({
          type: 'MAKE_MOVE',
          edgeId,
          playerId
        });
      }
    }
  };

  const handleSelectEdge = (edgeId: string) => {
    if (!gameState || gameState.phase !== 'playing') return;
    const activePlayer = gameState.players[gameState.currentTurnIndex];

    if (gameMode === 'multiplayer') {
      if (activePlayer.id !== myPlayerId) return;
      if (isHost) {
        executeMove(edgeId, myPlayerId);
      } else {
        peerManager.sendToHost({
          type: 'MAKE_MOVE',
          edgeId,
          playerId: myPlayerId
        });
      }
    } else {
      // Local Pass & Play or Solo
      executeMove(edgeId, activePlayer.id);
    }
  };

  // -------------------------------------------------------------
  // ONLINE HOST / JOIN ACTIONS
  // -------------------------------------------------------------
  const handleHostGame = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const generatedCode = (roomCode || generateRoomCode()).trim().toUpperCase();
    setRoomCode(generatedCode);
    roomCodeRef.current = generatedCode;

    try {
      await peerManager.hostRoom(generatedCode);
      setIsHost(true);
      isHostRef.current = true;

      const hostPlayer: Player = {
        id: myPlayerIdRef.current,
        name: myPlayerNameRef.current.trim() || 'Player 1',
        initial: getFirstLetter(myPlayerNameRef.current.trim() || 'Player 1'),
        color: myColorRef.current,
        score: 0,
        isHost: true,
        connected: true
      };

      const initialPlayers = [hostPlayer];
      setLobbyPlayers(initialPlayers);
      lobbyPlayersRef.current = initialPlayers;

      const initialBoardState = createInitialGameState(selectedGridRef.current, initialPlayers);
      setGameState(initialBoardState);
      stateRef.current = initialBoardState;
      setIsWaitingInRoom(true);

      // Start LAN discovery heartbeat
      peerManager.startLanHeartbeat({
        roomId: generatedCode,
        hostName: hostPlayer.name,
        dotCols: selectedGridRef.current.dotCols,
        dotRows: selectedGridRef.current.dotRows,
        currentPlayers: 1,
        maxPlayers: 5
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to host room. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGame = async (
    codeOverride?: string,
    playerOverride?: { id: string; name: string; color: PlayerColor }
  ) => {
    const raw = codeOverride || roomCode;
    const targetCode = (raw || '').trim().toUpperCase();

    if (!targetCode) {
      setErrorMessage('Please enter a valid Room Code.');
      return;
    }

    setRoomCode(targetCode);
    roomCodeRef.current = targetCode;
    setIsLoading(true);
    setErrorMessage(null);

    // Cancel any previous timeout
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }

    // Safety timeout: if after 15 seconds no response from host
    joinTimeoutRef.current = setTimeout(() => {
      setIsLoading(loading => {
        if (loading) {
          setErrorMessage(`Could not reach host for room "${targetCode}". Check room code or Wi-Fi connection.`);
          return false;
        }
        return false;
      });
    }, 15000);

    try {
      setIsHost(false);
      isHostRef.current = false;

      const playerInfo = playerOverride || {
        id: myPlayerIdRef.current,
        name: myPlayerNameRef.current.trim() || 'Player',
        color: myColorRef.current
      };

      await peerManager.joinRoom(targetCode, playerInfo);
    } catch (err: any) {
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      setErrorMessage(err.message || 'Could not connect to room. Please check the code.');
      setIsLoading(false);
    }
  };

  const handleConfirmInviteProfile = (name: string, color: PlayerColor) => {
    setMyPlayerName(name);
    myPlayerNameRef.current = name;
    setMyColor(color);
    myColorRef.current = color;
    try {
      localStorage.setItem('ghar_ghar_name', name);
      localStorage.setItem('ghar_ghar_color', color);
      localStorage.setItem('ghar_ghar_profile_set', 'true');
    } catch (e) {}

    setShowInviteModal(false);

    const targetRoom = pendingInviteRoom || roomCodeRef.current;
    if (targetRoom) {
      handleJoinGame(targetRoom, {
        id: myPlayerIdRef.current,
        name,
        color
      });
    }
  };

  const handleCancelInviteProfile = () => {
    setShowInviteModal(false);
    setPendingInviteRoom(null);
    setRoomCode('');
    roomCodeRef.current = '';
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  // Called when user clicks "Join Room" button in Lobby
  const handleJoinFromLobby = (code?: string) => {
    const raw = code || roomCode;
    const targetCode = (raw || '').trim().toUpperCase();
    if (!targetCode) {
      setErrorMessage('Please enter a valid Room Code.');
      return;
    }
    if (!hasCustomizedProfile()) {
      setPendingInviteRoom(targetCode);
      setShowInviteModal(true);
    } else {
      handleJoinGame(targetCode);
    }
  };

  const syncLanHeartbeat = (playersCount: number) => {
    if (isHostRef.current && roomCodeRef.current) {
      peerManager.startLanHeartbeat({
        roomId: roomCodeRef.current,
        hostName: myPlayerNameRef.current.trim() || 'Player 1',
        dotCols: selectedGridRef.current.dotCols,
        dotRows: selectedGridRef.current.dotRows,
        currentPlayers: playersCount,
        maxPlayers: 5
      });
    }
  };

  const handleStartMultiplayerGame = () => {
    const playersToStart = lobbyPlayersRef.current.length >= 2
      ? lobbyPlayersRef.current
      : (stateRef.current?.players || []);

    if (!isHostRef.current || playersToStart.length < 2) return;

    const currentGrid = selectedGridRef.current;
    const freshState = createInitialGameState(currentGrid, playersToStart);
    freshState.phase = 'playing';

    setGameState(freshState);
    stateRef.current = freshState;
    setIsWaitingInRoom(false);

    // Broadcast START_GAME twice (immediately and at 250ms) to ensure all clients transition
    peerManager.broadcast({
      type: 'START_GAME',
      state: freshState
    });

    setTimeout(() => {
      peerManager.broadcast({
        type: 'START_GAME',
        state: freshState
      });
    }, 250);

    // Stop discovery heartbeat and delete from registry so in-progress game is hidden from LAN & WAN discovery
    peerManager.stopLanHeartbeat();
    if (roomCodeRef.current) {
      const code = roomCodeRef.current;
      fetch(`/api/lan-rooms?roomId=${encodeURIComponent(code)}`, {
        method: 'DELETE',
        keepalive: true
      }).catch(() => {});
      try {
        localStorage.removeItem('ghar_active_lan_room');
      } catch (e) {}
    }
  };

  const handleRejectJoin = (playerId: string) => {
    peerManager.broadcast({
      type: 'JOIN_REJECTED',
      reason: 'The host declined your request to join this match.',
      targetPlayerId: playerId
    });
    setPendingJoinRequest(null);
  };

  const handleApproveJoin = (req: { id: string; name: string; color: PlayerColor }) => {
    const currentState = stateRef.current;
    if (!currentState) {
      setPendingJoinRequest(null);
      return;
    }

    const currentPlayers = currentState.players;
    if (currentPlayers.length >= 5) {
      handleRejectJoin(req.id);
      return;
    }

    const newPlayer: Player = {
      id: req.id,
      name: req.name,
      initial: getFirstLetter(req.name),
      color: req.color,
      score: 0,
      isHost: false,
      connected: true
    };

    const updatedPlayers = [...currentPlayers, newPlayer];
    setLobbyPlayers(updatedPlayers);
    lobbyPlayersRef.current = updatedPlayers;

    const updatedState = { ...currentState, players: updatedPlayers };
    setGameState(updatedState);
    stateRef.current = updatedState;

    peerManager.broadcast({
      type: 'JOIN_ACCEPTED',
      state: updatedState,
      assignedId: newPlayer.id,
      targetPlayerId: req.id
    });

    peerManager.broadcast({
      type: 'PLAYER_JOINED',
      player: newPlayer
    });

    setPendingJoinRequest(null);
    sound.playBoxClaimed();
  };

  const handleAddBot = () => {
    if (!isHost || lobbyPlayers.length >= 5) return;
    const botIndex = lobbyPlayers.filter(p => p.isBot).length + 1;
    const takenColors = lobbyPlayers.map(p => p.color);
    const botColor = PLAYER_COLORS.find(c => !takenColors.includes(c)) || PLAYER_COLORS[botIndex % PLAYER_COLORS.length];

    const botPlayer: Player = {
      id: `bot_${Date.now()}`,
      name: `Bot ${botIndex}`,
      initial: `B${botIndex}`,
      color: botColor,
      score: 0,
      isHost: false,
      isBot: true,
      connected: true
    };

    const updated = [...lobbyPlayers, botPlayer];
    setLobbyPlayers(updated);

    if (gameState) {
      const updatedState = { ...gameState, players: updated };
      setGameState(updatedState);
      peerManager.broadcast({ type: 'PLAYER_JOINED', player: botPlayer });
    }

    syncLanHeartbeat(updated.length);
  };

  const handleRemovePlayer = (id: string) => {
    if (!isHost) return;
    const updated = lobbyPlayers.filter(p => p.id !== id);
    setLobbyPlayers(updated);

    if (gameState) {
      const updatedState = { ...gameState, players: updated };
      setGameState(updatedState);
      peerManager.broadcast({ type: 'PLAYER_LEFT', playerId: id });
    }

    syncLanHeartbeat(updated.length);
  };

  // -------------------------------------------------------------
  // LOCAL MODES: PASS & PLAY & SOLO VS BOTS
  // -------------------------------------------------------------
  const handleStartPassAndPlay = (configuredPlayers: Player[]) => {
    const initialState = createInitialGameState(selectedGrid, configuredPlayers);
    initialState.phase = 'playing';
    setGameState(initialState);
    setIsWaitingInRoom(false);
  };

  const handleStartVsBots = (count: number) => {
    const humanPlayer: Player = {
      id: myPlayerId,
      name: myPlayerName.trim() || 'Player 1',
      initial: getFirstLetter(myPlayerName.trim() || 'Player 1'),
      color: myColor,
      score: 0,
      isHost: true,
      connected: true
    };

    const allPlayers: Player[] = [humanPlayer];
    for (let i = 1; i <= count; i++) {
      const botColor = PLAYER_COLORS[i % PLAYER_COLORS.length];
      allPlayers.push({
        id: `ai_bot_${i}`,
        name: `Bot ${i}`,
        initial: `B${i}`,
        color: botColor,
        score: 0,
        isHost: false,
        isBot: true,
        connected: true
      });
    }

    const initialState = createInitialGameState(selectedGrid, allPlayers);
    initialState.phase = 'playing';
    setGameState(initialState);
    setIsWaitingInRoom(false);
  };

  // -------------------------------------------------------------
  // REMATCH & LEAVE
  // -------------------------------------------------------------
  const handleRematch = () => {
    if (!gameState) return;

    // Reset scores and reinitialize board with same players
    const resetPlayers = gameState.players.map(p => ({ ...p, score: 0 }));
    const freshState = createInitialGameState(gameState.grid, resetPlayers);
    freshState.phase = 'playing';

    setGameState(freshState);

    if (gameMode === 'multiplayer') {
      peerManager.broadcast({
        type: 'REMATCH',
        state: freshState
      });
    }
  };

  const handleLeaveGame = () => {
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }
    if (!isHostRef.current && myPlayerIdRef.current) {
      peerManager.broadcast({
        type: 'PLAYER_LEFT',
        playerId: myPlayerIdRef.current
      });
    }
    if (isHostRef.current && roomCodeRef.current) {
      const code = roomCodeRef.current;
      fetch(`/api/lan-rooms?roomId=${encodeURIComponent(code)}`, {
        method: 'DELETE',
        keepalive: true
      }).catch(() => {});
    }
    peerManager.destroy();
    voiceChatManager.destroy();
    setSpeakingPlayerIds(new Set());
    setIsTalking(false);
    voiceChatManager.init(myPlayerIdRef.current, (msg) => {
      peerManager.broadcast(msg);
    });
    setGameState(null);
    stateRef.current = null;
    setIsWaitingInRoom(false);
    setLobbyPlayers([]);
    lobbyPlayersRef.current = [];
    setIsHost(false);
    isHostRef.current = false;
    setIsLoading(false);
    setErrorMessage(null);
    setPendingJoinRequest(null);
    setIsWaitingForApproval(false);
    setRoomCode('');
    roomCodeRef.current = '';

    // Clear ?room= from browser address bar
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const openInGameQr = () => {
    if (roomCode) {
      const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
      QRCode.toDataURL(inviteUrl, { width: 280, margin: 2 })
        .then(url => {
          setInGameQrUrl(url);
          setShowQrModalInGame(true);
        })
        .catch(() => {});
    }
  };

  // -------------------------------------------------------------
  // MAIN VIEW RENDER
  // -------------------------------------------------------------
  const isInRoom = isWaitingInRoom || (!!gameState && gameState.phase !== 'lobby');

  return (
    <div className={`flex flex-col h-screen h-[100dvh] w-screen overflow-hidden select-none transition-colors duration-200 ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-paper-100 text-slate-800'
    }`}>
      {/* Top Header */}
      <Header
        roomCode={roomCode}
        mode={gameMode}
        grid={gameState?.grid || selectedGrid}
        darkMode={darkMode}
        isInRoom={isInRoom}
        showExit={isInRoom}
        lanRooms={lanRooms}
        onJoinLanRoom={(targetRoomId) => handleJoinGame(targetRoomId)}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onOpenRules={() => setIsRulesOpen(true)}
        onOpenQr={roomCode && gameMode === 'multiplayer' ? openInGameQr : undefined}
        onLeaveGame={handleLeaveGame}
      />

      {/* Main Body */}
      {(!gameState || gameState.phase === 'lobby') ? (
        <Lobby
          myPlayerName={myPlayerName}
          setMyPlayerName={setMyPlayerName}
          myColor={myColor}
          setMyColor={setMyColor}
          gameMode={gameMode}
          setGameMode={setGameMode}
          selectedGrid={selectedGrid}
          setSelectedGrid={setSelectedGrid}
          roomCode={roomCode}
          setRoomCode={setRoomCode}
          isHost={isHost}
          players={lobbyPlayers}
          isWaitingInRoom={isWaitingInRoom}
          onHostGame={handleHostGame}
          onJoinGame={handleJoinFromLobby}
          onStartGame={handleStartMultiplayerGame}
          onAddBot={handleAddBot}
          onRemovePlayer={handleRemovePlayer}
          onOpenRules={() => setIsRulesOpen(true)}
          onStartPassAndPlay={handleStartPassAndPlay}
          onStartVsBots={handleStartVsBots}
          errorMessage={errorMessage}
          isLoading={isLoading}
          onLeaveGame={handleLeaveGame}
          darkMode={darkMode}
          lanRooms={lanRooms}
          onScanLan={() => {
            PeerManager.fetchLanRooms().then(rooms => setLanRooms(rooms));
          }}
        />
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden relative">
          {/* Active Turn & Player Score Bar */}
          <PlayerBar
            players={gameState.players}
            currentTurnIndex={gameState.currentTurnIndex}
            myPlayerId={gameMode === 'multiplayer' ? myPlayerId : null}
            totalBoxes={gameState.totalBoxes}
            bonusTurnAwarded={gameState.bonusTurnAwarded}
            darkMode={darkMode}
            speakingPlayerIds={speakingPlayerIds}
          />

          {/* Interactive SVG Board Canvas */}
          <GameBoard
            state={gameState}
            myPlayerId={gameMode === 'multiplayer' ? myPlayerId : null}
            darkMode={darkMode}
            onSelectEdge={handleSelectEdge}
            enableVoiceChat={gameMode === 'multiplayer'}
            isTalking={isTalking}
            onStartTalking={() => voiceChatManager.startTalking()}
            onStopTalking={() => voiceChatManager.stopTalking()}
          />

          {/* Game Over Modal */}
          <GameOverModal
            isOpen={gameState.phase === 'game_over'}
            players={gameState.players}
            totalBoxes={gameState.totalBoxes}
            winnerIds={gameState.winnerIds}
            isHost={gameMode !== 'multiplayer' || isHost}
            onRematch={handleRematch}
            onBackToLobby={handleLeaveGame}
            darkMode={darkMode}
          />
        </div>
      )}

      {/* Rules Modal */}
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} darkMode={darkMode} />

      {/* In-Game QR Modal */}
      {showQrModalInGame && inGameQrUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className={`rounded-3xl p-6 md:p-8 max-w-sm w-full text-center shadow-2xl border ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-paper-300 text-slate-800'
          }`}>
            <h3 className={`text-xl font-bold font-sketch mb-1 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
              Invite Friends to Game
            </h3>
            <p className={`text-xs mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Scan this QR code with any smartphone to join room <strong className={`font-mono ${darkMode ? 'text-white' : 'text-slate-900'}`}>{roomCode}</strong>
            </p>
            <div className={`p-3 rounded-2xl inline-block border mb-4 shadow-inner ${
              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-paper-50 border-paper-200'
            }`}>
              <img src={inGameQrUrl} alt="Room QR Code" className="w-56 h-56 mx-auto rounded-lg" />
            </div>
            <button
              onClick={() => setShowQrModalInGame(false)}
              className={`w-full py-2.5 font-semibold rounded-xl transition-all shadow-md cursor-pointer ${
                darkMode ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-slate-800 hover:bg-slate-900 text-white'
              }`}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Host In-Game Join Approval Modal */}
      {isHost && pendingJoinRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className={`rounded-3xl p-6 md:p-7 max-w-sm w-full shadow-2xl border ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-paper-300 text-slate-800'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <ClaimedHomeBadge
                initial={getFirstLetter(pendingJoinRequest.name)}
                color={pendingJoinRequest.color}
                darkMode={darkMode}
                sizeClass="w-12 h-12"
              />
              <div>
                <h4 className={`font-bold text-base ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {pendingJoinRequest.name}
                </h4>
                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  wants to join this match in progress
                </p>
              </div>
            </div>

            <p className={`text-xs md:text-sm mb-6 p-3 rounded-xl border ${
              darkMode ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-paper-100 border-paper-200 text-slate-700'
            }`}>
              A new player has requested to enter the game. If approved, they will be added to the turn rotation.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => handleRejectJoin(pendingJoinRequest.id)}
                className={`flex-1 py-2.5 font-bold text-xs rounded-xl border transition-all cursor-pointer ${
                  darkMode ? 'text-red-400 border-red-900/60 hover:bg-red-950/40' : 'text-red-600 border-red-200 hover:bg-red-50'
                }`}
              >
                Decline
              </button>
              <button
                onClick={() => handleApproveJoin(pendingJoinRequest)}
                className="flex-1 py-2.5 font-bold text-xs rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all cursor-pointer"
              >
                Approve & Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest: Waiting for Host Approval Screen */}
      {isWaitingForApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className={`rounded-3xl p-6 md:p-8 max-w-sm w-full text-center shadow-2xl border ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-paper-300 text-slate-800'
          }`}>
            <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center border ${
              darkMode ? 'bg-amber-950/60 border-amber-800 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600'
            }`}>
              <RefreshCw className="w-7 h-7 animate-spin text-amber-500" />
            </div>
            <h3 className={`text-xl font-bold font-sketch mb-1.5 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              Waiting for Host Approval
            </h3>
            <p className={`text-xs mb-6 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              This match is currently in progress. A join request has been sent to the host.
            </p>
            <button
              onClick={handleLeaveGame}
              className={`w-full py-2.5 font-semibold text-xs rounded-xl border transition-all cursor-pointer ${
                darkMode ? 'text-red-400 border-red-900/50 hover:bg-red-950/40' : 'text-red-600 border-red-200 hover:bg-red-50'
              }`}
            >
              Cancel Request
            </button>
          </div>
        </div>
      )}

      {/* Invite Profile Setup Modal */}
      {showInviteModal && (
        <InviteProfileModal
          roomCode={pendingInviteRoom || roomCode}
          initialName={myPlayerName}
          initialColor={myColor}
          darkMode={darkMode}
          onConfirm={handleConfirmInviteProfile}
          onCancel={handleCancelInviteProfile}
        />
      )}
    </div>
  );
};

export default App;
