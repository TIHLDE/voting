import { useEffect, useRef } from 'react';

export function useWebSocket(channel: string, onMessage: (data: unknown) => void) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!channel) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let disposed = false;

    function connect() {
      if (disposed) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/_ws`);

      ws.onopen = () => {
        ws!.send(JSON.stringify({ type: 'subscribe', channel }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.channel === channel) {
            onMessageRef.current(msg.data);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!disposed) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [channel]);
}
