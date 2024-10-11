import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

const options: Redis.RedisOptions = {
    host: process.env.REDIS_HOST,
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    db: 0,
    connectTimeout: 5000,
    keepAlive: 3000,
    
    retryStrategy: () => {
        // reconnect after
        return 2000;
    },
};

export const pubsub = new RedisPubSub({
                //@ts-expect-error broken types
                publisher: new Redis(options),
                // @ts-expect-error broken types
              subscriber: new Redis(options),
          })
