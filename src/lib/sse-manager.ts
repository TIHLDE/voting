type Handler = (data: unknown) => void;

class SSEManager {
    private eventSource: EventSource | null = null;
    private channels = new Map<string, Set<Handler>>();
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    subscribe(channel: string, callback: Handler): () => void {
        if (!this.channels.has(channel)) {
            this.channels.set(channel, new Set());
        }
        this.channels.get(channel)!.add(callback);
        this.scheduleReconnect();

        return () => {
            const set = this.channels.get(channel);
            if (set) {
                set.delete(callback);
                if (set.size === 0) {
                    this.channels.delete(channel);
                    this.scheduleReconnect();
                }
            }
        };
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connect(), 50);
    }

    private connect() {
        const channelList = Array.from(this.channels.keys());

        // Close existing connection
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        if (channelList.length === 0) return;

        const url = `/api/sse?channels=${encodeURIComponent(channelList.join(','))}`;
        this.eventSource = new EventSource(url);

        this.eventSource.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                const handlers = this.channels.get(msg.channel);
                if (handlers) {
                    for (const handler of handlers) {
                        handler(msg.data);
                    }
                }
            } catch {
                // ignore malformed messages
            }
        };
    }
}

export const sseManager =
    typeof window !== 'undefined' ? new SSEManager() : null;
