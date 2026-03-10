interface WsConnection {
  send(data: string | ArrayBufferLike): void;
}

interface WsState {
  channels: Map<string, Set<WsConnection>>;
  peerChannels: Map<WsConnection, Set<string>>;
}

const KEY = '__ws_emitter__';

function getState(): WsState {
  const g = globalThis as Record<string, unknown>;
  if (!g[KEY]) {
    g[KEY] = {
      channels: new Map<string, Set<WsConnection>>(),
      peerChannels: new Map<WsConnection, Set<string>>(),
    };
  }
  return g[KEY] as WsState;
}

export function addSubscriber(channel: string, ws: WsConnection) {
  const { channels, peerChannels } = getState();

  if (!channels.has(channel)) channels.set(channel, new Set());
  channels.get(channel)!.add(ws);

  if (!peerChannels.has(ws)) peerChannels.set(ws, new Set());
  peerChannels.get(ws)!.add(channel);
}

export function removeSubscriber(ws: WsConnection) {
  const { channels, peerChannels } = getState();
  const subs = peerChannels.get(ws);
  if (!subs) return;

  for (const channel of subs) {
    const set = channels.get(channel);
    if (set) {
      set.delete(ws);
      if (set.size === 0) channels.delete(channel);
    }
  }
  peerChannels.delete(ws);
}

export function publish(channel: string, data: unknown) {
  const { channels } = getState();
  const set = channels.get(channel);
  if (!set || set.size === 0) return;

  const message = JSON.stringify({ channel, data });

  for (const ws of set) {
    try {
      ws.send(message);
    } catch {
      set.delete(ws);
    }
  }

  if (set.size === 0) channels.delete(channel);
}
