import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import IORedis from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: IORedis;
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const redis = new IORedis(url, { maxRetriesPerRequest: null });

  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async () => {
    redis.disconnect();
  });
};

export default fp(redisPlugin, { name: 'redis' });
