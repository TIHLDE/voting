import { defineWebSocketHandler } from 'nitro/h3';
import { addSubscriber, removeSubscriber } from '../../src/server/ws/emitter';

export default defineWebSocketHandler({
  message(peer, msg) {
    try {
      const data = JSON.parse(msg.text());
      if (data.type === 'subscribe' && typeof data.channel === 'string') {
        addSubscriber(data.channel, peer);
      }
    } catch {
      // ignore malformed messages
    }
  },
  close(peer) {
    removeSubscriber(peer);
  },
});
