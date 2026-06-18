import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { MongoClient, Db } from 'mongodb';

declare module 'fastify' {
  interface FastifyInstance {
    mongo: Db;
  }
}

const mongoPlugin: FastifyPluginAsync = async (fastify) => {
  const uri = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/mercury';
  const client = new MongoClient(uri);
  await client.connect();

  const url = new URL(uri);
  const dbName = url.pathname.replace(/^\//, '') || 'mercury';
  const db = client.db(dbName);

  fastify.decorate('mongo', db);

  fastify.addHook('onClose', async () => {
    await client.close();
  });
};

export default fp(mongoPlugin, { name: 'mongo' });
