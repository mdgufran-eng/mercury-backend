"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const core_1 = require("@mercury/core");
const brokerPlugin = async (fastify) => {
    const url = new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
    const conn = {
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        password: url.password || undefined,
        maxRetriesPerRequest: null,
    };
    // Swap BullMQBroker → KafkaBroker here when BROKER=kafka:
    // const broker = process.env.BROKER === 'kafka'
    //   ? new KafkaBroker((process.env.KAFKA_BROKERS ?? '').split(','))
    //   : new BullMQBroker(conn);
    const broker = new core_1.BullMQBroker(conn);
    fastify.decorate('broker', broker);
};
exports.default = (0, fastify_plugin_1.default)(brokerPlugin, { name: 'broker' });
