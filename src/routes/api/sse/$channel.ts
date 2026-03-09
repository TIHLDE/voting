import { createFileRoute } from '@tanstack/react-router'
import { subscribe } from '#/server/sse/emitter.ts'

export const Route = createFileRoute('/api/sse/$channel')({
  server: {
    handlers: {
      GET: ({ params }: { params: { channel: string } }) => {
        const stream = subscribe(params.channel)

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      },
    },
  },
})
