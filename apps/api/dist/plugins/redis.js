"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const ioredis_1 = __importDefault(require("ioredis"));
const redisPlugin = async (fastify) => {
    const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
    const redis = new ioredis_1.default(url, { maxRetriesPerRequest: null });
    fastify.decorate('redis', redis);
    fastify.addHook('onClose', async () => {
        redis.disconnect();
    });
};
exports.default = (0, fastify_plugin_1.default)(redisPlugin, { name: 'redis' });
