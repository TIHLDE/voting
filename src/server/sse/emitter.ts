const KEY = '__sse_emitter__';

interface SseState {
  channels: Map<string, Set<ReadableStreamDefaultController>>;
  controllerChannels: Map<ReadableStreamDefaultController, Set<string>>;
}

function getState(): SseState {
  const g = globalThis as Record<string, unknown>;
  if (!g[KEY]) {
    g[KEY] = {
      channels: new Map<string, Set<ReadableStreamDefaultController>>(),
      controllerChannels: new Map<ReadableStreamDefaultController, Set<string>>(),
    };
  }
  return g[KEY] as SseState;
}

const encoder = new TextEncoder();

export function addSubscriber(channel: string, controller: ReadableStreamDefaultController) {
  const { channels, controllerChannels } = getState();

  if (!channels.has(channel)) channels.set(channel, new Set());
  channels.get(channel)!.add(controller);

  if (!controllerChannels.has(controller)) controllerChannels.set(controller, new Set());
  controllerChannels.get(controller)!.add(channel);
}

export function removeSubscriber(controller: ReadableStreamDefaultController) {
  const { channels, controllerChannels } = getState();
  const subs = controllerChannels.get(controller);
  if (!subs) return;

  for (const channel of subs) {
    const set = channels.get(channel);
    if (set) {
      set.delete(controller);
      if (set.size === 0) channels.delete(channel);
    }
  }
  controllerChannels.delete(controller);
}

export function publish(channel: string, data: unknown) {
  const { channels } = getState();
  const set = channels.get(channel);
  if (!set || set.size === 0) return;

  const message = encoder.encode(`data: ${JSON.stringify({ channel, data })}\n\n`);

  for (const controller of set) {
    try {
      controller.enqueue(message);
    } catch {
      set.delete(controller);
    }
  }

  if (set.size === 0) channels.delete(channel);
}
