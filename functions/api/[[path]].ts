interface Env {
  GAME_ROOMS: DurableObjectNamespace;
}

/**
 * Keeps the Pages deployment on one origin while forwarding the multiplayer
 * API to the Durable Object Worker. The registry has one stable object; each
 * game has its own stable object keyed by its room code.
 */
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const roomMatch = url.pathname.match(/^\/api\/room\/([^/]+)$/);
  const signalRoom = url.searchParams.get('roomId');

  const objectName = roomMatch
    ? `room:${roomMatch[1].trim().toUpperCase()}`
    : url.pathname === '/api/lan-signal' && signalRoom
      ? `room:${signalRoom.trim().toUpperCase()}`
      : 'room-registry';

  const clientIp = request.headers.get('CF-Connecting-IP')?.trim() || '';

  const headers = new Headers(request.headers);
  headers.delete('x-client-network');
  if (clientIp) {
    headers.set('x-client-network', clientIp);
  }

  const proxiedRequest = new Request(request, { headers });
  const id = env.GAME_ROOMS.idFromName(objectName);
  return env.GAME_ROOMS.get(id).fetch(proxiedRequest);
};
