import { FastifyPluginAsync } from 'fastify';
import type { MessageBroker } from '@mercury/core';
declare module 'fastify' {
    interface FastifyInstance {
        broker: MessageBroker;
    }
}
declare const _default: FastifyPluginAsync;
export default _default;
