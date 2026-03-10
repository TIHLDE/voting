import { useEffect, useRef } from 'react';

export function useSSE(channel: string, onMessage: (data: unknown) => void) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!channel) return;

    const eventSource = new EventSource(`/api/sse?channel=${encodeURIComponent(channel)}`);

    eventSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.channel === channel) {
          onMessageRef.current(msg.data);
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => eventSource.close();
  }, [channel]);
}
