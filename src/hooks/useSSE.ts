import { useEffect, useRef } from 'react';
import type { z } from 'zod';
import type { LiveEvent } from '#/lib/live-events';
import { sseManager } from '#/lib/sse-manager';

export function useSSE<TSchema extends z.ZodType>(
    event: LiveEvent<TSchema> | null,
    onMessage: (data: z.output<TSchema>) => void,
    onReconnect?: () => void,
) {
    const onMessageRef = useRef(onMessage);
    const onReconnectRef = useRef(onReconnect);
    onMessageRef.current = onMessage;
    onReconnectRef.current = onReconnect;

    useEffect(() => {
        if (!event || !sseManager) return;

        return sseManager.subscribe(event.channel, {
            onMessage: (data) => {
                const result = event.schema.safeParse(data);
                if (result.success) onMessageRef.current(result.data);
            },
            onReconnect: () => onReconnectRef.current?.(),
        });
    }, [event?.channel]);
}
