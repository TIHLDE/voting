import { useEffect, useEffectEvent } from 'react';
import type { z } from 'zod';
import type { LiveEvent } from '#/lib/live-events';
import { sseManager } from '#/lib/sse-manager';

export function useSSE<TSchema extends z.ZodType>(
    event: LiveEvent<TSchema> | null,
    onMessage: (data: z.output<TSchema>) => void,
    onReconnect?: () => void,
) {
    const handleMessage = useEffectEvent(onMessage);
    const handleReconnect = useEffectEvent(() => onReconnect?.());

    useEffect(() => {
        if (!event || !sseManager) return;

        return sseManager.subscribe(event.channel, {
            onMessage: (data) => {
                const result = event.schema.safeParse(data);
                if (result.success) handleMessage(result.data);
            },
            onReconnect: handleReconnect,
        });
    }, [event?.channel, event?.schema]);
}
