import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { MongoClient, Db } from 'mongodb';
import { createIndexes } from '@mercury/core';
import { runSeed } from '@mercury/core';

declare module 'fastify' {
  interface FastifyInstance {
    mongo: Db;
  }
}

const mongoPlugin: FastifyPluginAsync = async (fastify) => {
  const uri = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/mercury';
  const client = new MongoClient(uri, { maxPoolSize: 20 });
  await client.connect();

  const dbName = new URL(uri).pathname.replace(/^\//, '') || 'mercury';
  const db = client.db(dbName);

  // Ensure indexes exist and reference data is seeded on every boot.
  // Both operations are idempotent — safe to run repeatedly.
  await createIndexes(db);
  await runSeed(db);

  fastify.decorate('mongo', db);

  fastify.addHook('onClose', async () => {
    await client.close();
  });
};

export default fp(mongoPlugin, { name: 'mongo' });
