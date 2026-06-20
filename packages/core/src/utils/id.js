"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextId = nextId;
const collections_js_1 = require("../db/collections.js");
const SEED = 200_000_000;
/**
 * Returns the next numeric ID for the given counter name.
 * Counter is seeded at 200_000_000 on first use.
 * Uses MongoDB findOneAndUpdate with $inc for atomic increments.
 */
async function nextId(db, name) {
    const col = (0, collections_js_1.counters)(db);
    // Ensure the counter exists with the seed value if it doesn't yet
    await col.updateOne({ _id: name, seq: { $exists: false } }, { $set: { _id: name, seq: SEED } }, { upsert: true });
    const result = await col.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { returnDocument: 'after', upsert: true });
    if (!result) {
        throw new Error(`Failed to generate next ID for counter: ${name}`);
    }
    return result.seq;
}
