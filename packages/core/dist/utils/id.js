"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextId = nextId;
exports.nextIdRange = nextIdRange;
const collections_js_1 = require("../db/collections.js");
const SEED = 200_000_000;
// Atomically initialise (on first use) and increment the named counter.
// Single round-trip — no race between "does it exist?" and "increment".
async function nextId(db, name) {
    const col = (0, collections_js_1.counters)(db);
    const result = await col.findOneAndUpdate({ _id: name }, [{ $set: { seq: { $add: [{ $ifNull: ['$seq', SEED] }, 1] } } }], { returnDocument: 'after', upsert: true });
    if (!result)
        throw new Error(`Failed to generate next ID for counter: ${name}`);
    return result.seq;
}
// Allocate `count` IDs in one round-trip — use instead of calling nextId()
// in a loop when you need many IDs (e.g. bulk segment inserts).
// Returns a contiguous range [start, start+1, ..., start+count-1].
async function nextIdRange(db, name, count) {
    if (count <= 0)
        return [];
    const col = (0, collections_js_1.counters)(db);
    const result = await col.findOneAndUpdate({ _id: name }, [{ $set: { seq: { $add: [{ $ifNull: ['$seq', SEED] }, count] } } }], { returnDocument: 'after', upsert: true });
    if (!result)
        throw new Error(`Failed to allocate ID range for counter: ${name}`);
    const end = result.seq;
    const start = end - count + 1;
    return Array.from({ length: count }, (_, i) => start + i);
}
