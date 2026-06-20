"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const mongodb_1 = require("mongodb");
const core_1 = require("@mercury/core");
const core_2 = require("@mercury/core");
const mongoPlugin = async (fastify) => {
    const uri = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/mercury';
    const client = new mongodb_1.MongoClient(uri, { maxPoolSize: 20 });
    await client.connect();
    const dbName = new URL(uri).pathname.replace(/^\//, '') || 'mercury';
    const db = client.db(dbName);
    // Ensure indexes exist and reference data is seeded on every boot.
    // Both operations are idempotent — safe to run repeatedly.
    await (0, core_1.createIndexes)(db);
    await (0, core_2.runSeed)(db);
    fastify.decorate('mongo', db);
    fastify.addHook('onClose', async () => {
        await client.close();
    });
};
exports.default = (0, fastify_plugin_1.default)(mongoPlugin, { name: 'mongo' });
