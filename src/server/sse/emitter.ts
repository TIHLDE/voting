type Controller = ReadableStreamDefaultController<Uint8Array>

const channels = new Map<string, Set<Controller>>()

export function subscribe(channel: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      if (!channels.has(channel)) {
        channels.set(channel, new Set())
      }
      channels.get(channel)!.add(controller)

      // Send initial connection message
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(': connected\n\n'))
    },
    cancel(controller) {
      const set = channels.get(channel)
      if (set) {
        set.delete(controller as Controller)
        if (set.size === 0) {
          channels.delete(channel)
        }
      }
    },
  })
}

export function publish(channel: string, data: unknown) {
  const set = channels.get(channel)
  if (!set || set.size === 0) return

  const encoder = new TextEncoder()
  const message = `data: ${JSON.stringify(data)}\n\n`
  const encoded = encoder.encode(message)

  for (const controller of set) {
    try {
      controller.enqueue(encoded)
    } catch {
      set.delete(controller)
    }
  }

  if (set.size === 0) {
    channels.delete(channel)
  }
}

export function getSubscriberCount(channel: string): number {
  return channels.get(channel)?.size ?? 0
}
