import { createFileRoute } from '@tanstack/react-router';
import { addSubscriber, removeSubscriber } from '#/server/sse/emitter';

export const Route = createFileRoute('/api/sse')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const channel = url.searchParams.get('channel');

        if (!channel) {
          return new Response('Missing channel parameter', { status: 400 });
        }

        const encoder = new TextEncoder();
        let controllerRef: ReadableStreamDefaultController | null = null;
        let heartbeat: ReturnType<typeof setInterval> | null = null;

        const stream = new ReadableStream({
          start(controller) {
            controllerRef = controller;
            addSubscriber(channel, controller);
            controller.enqueue(encoder.encode(': connected\n\n'));

            heartbeat = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(': heartbeat\n\n'));
              } catch {
                if (heartbeat) clearInterval(heartbeat);
              }
            }, 30_000);
          },
          cancel() {
            if (heartbeat) clearInterval(heartbeat);
            if (controllerRef) removeSubscriber(controllerRef);
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      },
    },
  },
});
