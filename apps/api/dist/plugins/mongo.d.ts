import { FastifyPluginAsync } from 'fastify';
import { Db } from 'mongodb';
declare module 'fastify' {
    interface FastifyInstance {
        mongo: Db;
    }
}
declare const _default: FastifyPluginAsync;
export default _default;
