import { Db } from 'mongodb';
/**
 * Returns the next numeric ID for the given counter name.
 * Counter is seeded at 200_000_000 on first use.
 * Uses MongoDB findOneAndUpdate with $inc for atomic increments.
 */
export declare function nextId(db: Db, name: string): Promise<number>;
