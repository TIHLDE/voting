import { useEffect, useRef } from 'react'

export function useSSE(channel: string, onMessage: (data: unknown) => void) {
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    if (!channel) return

    const encodedChannel = encodeURIComponent(channel)
    const eventSource = new EventSource(`/api/sse/${encodedChannel}`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessageRef.current(data)
      } catch {
        // Ignore parse errors (e.g. comments)
      }
    }

    eventSource.onerror = () => {
      // EventSource will auto-reconnect
    }

    return () => {
      eventSource.close()
    }
  }, [channel])
}
