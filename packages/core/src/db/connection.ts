import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(uri?: string): Promise<Db> {
  if (db) return db;

  const connectionUri = uri ?? process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/mercury';
  client = new MongoClient(connectionUri);
  await client.connect();

  const url = new URL(connectionUri);
  const dbName = url.pathname.replace(/^\//, '') || 'mercury';
  db = client.db(dbName);
  return db;
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export function getDb(): Db {
  if (!db) {
    throw new Error('MongoDB not connected. Call connectMongo() first.');
  }
  return db;
}
