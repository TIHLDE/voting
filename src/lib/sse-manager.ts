type Subscription = {
    onMessage: (data: unknown) => void;
    onReconnect?: () => void;
};

class SSEManager {
    private eventSource: EventSource | null = null;
    private channels = new Map<string, Set<Subscription>>();
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private hasConnected = false;

    subscribe(channel: string, subscription: Subscription): () => void {
        if (!this.channels.has(channel)) {
            this.channels.set(channel, new Set());
        }
        this.channels.get(channel)!.add(subscription);
        this.scheduleReconnect();

        return () => {
            const subscriptions = this.channels.get(channel);
            if (!subscriptions) return;

            subscriptions.delete(subscription);
            if (subscriptions.size === 0) {
                this.channels.delete(channel);
                this.scheduleReconnect();
            }
        };
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, 50);
    }

    private connect() {
        const channelList = Array.from(this.channels.keys());

        this.eventSource?.close();
        this.eventSource = null;

        if (channelList.length === 0) return;

        const url = `/api/sse?channels=${encodeURIComponent(channelList.join(','))}`;
        this.eventSource = new EventSource(url);

        this.eventSource.onopen = () => {
            if (this.hasConnected) {
                for (const subscriptions of this.channels.values()) {
                    for (const subscription of subscriptions) {
                        subscription.onReconnect?.();
                    }
                }
            }
            this.hasConnected = true;
        };

        this.eventSource.onmessage = (message) => {
            try {
                const parsed: unknown = JSON.parse(message.data);
                if (
                    !parsed ||
                    typeof parsed !== 'object' ||
                    !('channel' in parsed) ||
                    typeof parsed.channel !== 'string' ||
                    !('data' in parsed)
                ) {
                    return;
                }

                const subscriptions = this.channels.get(parsed.channel);
                if (!subscriptions) return;

                for (const subscription of subscriptions) {
                    subscription.onMessage(parsed.data);
                }
            } catch {
                // Ignore malformed transport messages. Event payloads are
                // validated by useSSE before reaching application code.
            }
        };
    }
}

export const sseManager =
    typeof window !== 'undefined' ? new SSEManager() : null;
