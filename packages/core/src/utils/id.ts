import { Db } from 'mongodb';
import { counters } from '../db/collections.js';

const SEED = 200_000_000;

// Atomically initialise (on first use) and increment the named counter.
// Uses a MongoDB aggregation pipeline update so the entire operation is one
// round-trip — no race condition between "does it exist?" and "increment".
export async function nextId(db: Db, name: string): Promise<number> {
  const col = counters(db);

  const result = await col.findOneAndUpdate(
    { _id: name },
    [
      {
        $set: {
          seq: {
            $add: [{ $ifNull: ['$seq', SEED] }, 1],
          },
        },
      },
    ],
    { returnDocument: 'after', upsert: true },
  );

  if (!result) throw new Error(`Failed to generate next ID for counter: ${name}`);
  return result.seq;
}
