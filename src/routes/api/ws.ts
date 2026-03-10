import { createFileRoute } from '@tanstack/react-router';
import { addSubscriber, removeSubscriber } from '#/server/ws/emitter';

export const Route = createFileRoute('/api/ws')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
        if (request.headers.get('Upgrade') !== 'websocket') {
          return new Response('Expected WebSocket upgrade', { status: 426 });
        }

        const { 0: client, 1: server } = new WebSocketPair();
        server.accept();

        server.addEventListener('message', (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data as string);
            if (data.type === 'subscribe' && typeof data.channel === 'string') {
              addSubscriber(data.channel, server);
            }
          } catch {
            // ignore malformed messages
          }
        });

        server.addEventListener('close', () => {
          removeSubscriber(server);
        });

        return new Response(null, { status: 101, webSocket: client });
      },
    },
  },
});
