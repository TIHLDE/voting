import { useEffect, useRef } from 'react';
import { sseManager } from '#/lib/sse-manager';

export function useSSE(channel: string, onMessage: (data: unknown) => void) {
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    useEffect(() => {
        if (!channel || !sseManager) return;
        return sseManager.subscribe(channel, (data) =>
            onMessageRef.current(data),
        );
    }, [channel]);
}
