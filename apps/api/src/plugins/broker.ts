import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { BullMQBroker } from '@mercury/core';
import type { MessageBroker } from '@mercury/core';

declare module 'fastify' {
  interface FastifyInstance {
    broker: MessageBroker;
  }
}

const brokerPlugin: FastifyPluginAsync = async (fastify) => {
  const url = new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
  const conn = {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
  };

  // Swap BullMQBroker → KafkaBroker here when BROKER=kafka:
  // const broker = process.env.BROKER === 'kafka'
  //   ? new KafkaBroker((process.env.KAFKA_BROKERS ?? '').split(','))
  //   : new BullMQBroker(conn);
  const broker: MessageBroker = new BullMQBroker(conn);

  fastify.decorate('broker', broker);
};

export default fp(brokerPlugin, { name: 'broker' });
