import { FastifyPluginAsync } from 'fastify';
import IORedis from 'ioredis';
declare module 'fastify' {
    interface FastifyInstance {
        redis: IORedis;
    }
}
declare const _default: FastifyPluginAsync;
export default _default;
