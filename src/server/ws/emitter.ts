import type { Peer } from 'crossws';

interface WsState {
  channels: Map<string, Set<Peer>>;
  peerChannels: Map<Peer, Set<string>>;
}

const KEY = '__ws_emitter__';

function getState(): WsState {
  const g = globalThis as Record<string, unknown>;
  if (!g[KEY]) {
    g[KEY] = {
      channels: new Map<string, Set<Peer>>(),
      peerChannels: new Map<Peer, Set<string>>(),
    };
  }
  return g[KEY] as WsState;
}

export function addSubscriber(channel: string, peer: Peer) {
  const { channels, peerChannels } = getState();

  if (!channels.has(channel)) channels.set(channel, new Set());
  channels.get(channel)!.add(peer);

  if (!peerChannels.has(peer)) peerChannels.set(peer, new Set());
  peerChannels.get(peer)!.add(channel);
}

export function removeSubscriber(peer: Peer) {
  const { channels, peerChannels } = getState();
  const subs = peerChannels.get(peer);
  if (!subs) return;

  for (const channel of subs) {
    const set = channels.get(channel);
    if (set) {
      set.delete(peer);
      if (set.size === 0) channels.delete(channel);
    }
  }
  peerChannels.delete(peer);
}

export function publish(channel: string, data: unknown) {
  const { channels } = getState();
  const set = channels.get(channel);
  if (!set || set.size === 0) return;

  const message = JSON.stringify({ channel, data });

  for (const peer of set) {
    try {
      peer.send(message);
    } catch {
      set.delete(peer);
    }
  }

  if (set.size === 0) channels.delete(channel);
}
