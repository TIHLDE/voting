import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

const options: Redis.RedisOptions = {
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_PASSWORD,
    port: 6379,
    db: 0,
    connectTimeout: 5000,
    keepAlive: 3000,
    
    retryStrategy: () => {
        // reconnect after
        return 2000;
    },
};

export const pubsub = new RedisPubSub({
              publisher: new Redis(options),
              subscriber: new Redis(options),
          })
