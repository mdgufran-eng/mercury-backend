"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const mongo_js_1 = __importDefault(require("./plugins/mongo.js"));
const redis_js_1 = __importDefault(require("./plugins/redis.js"));
const broker_js_1 = __importDefault(require("./plugins/broker.js"));
const errorHandler_js_1 = __importDefault(require("./plugins/errorHandler.js"));
const health_js_1 = __importDefault(require("./routes/health.js"));
const projects_js_1 = __importDefault(require("./routes/xtm/projects.js"));
const files_js_1 = __importDefault(require("./routes/xtm/files.js"));
const costs_js_1 = __importDefault(require("./routes/xtm/costs.js"));
const projects_js_2 = __importDefault(require("./routes/admin/projects.js"));
const jobs_js_1 = __importDefault(require("./routes/admin/jobs.js"));
const segments_js_1 = __importDefault(require("./routes/admin/segments.js"));
const callbacks_js_1 = __importDefault(require("./routes/admin/callbacks.js"));
const customers_js_1 = __importDefault(require("./routes/admin/customers.js"));
const templates_js_1 = __importDefault(require("./routes/admin/templates.js"));
const freelancers_js_1 = __importDefault(require("./routes/admin/freelancers.js"));
const tm_js_1 = __importDefault(require("./routes/admin/tm.js"));
const trainingData_js_1 = __importDefault(require("./routes/admin/trainingData.js"));
async function buildApp() {
    const fastify = (0, fastify_1.default)({ logger: true });
    // Error handler must be registered first so all routes use it
    await fastify.register(errorHandler_js_1.default);
    // Infrastructure plugins
    await fastify.register(cors_1.default, { origin: true });
    await fastify.register(multipart_1.default, { limits: { fileSize: 50 * 1024 * 1024 } });
    await fastify.register(mongo_js_1.default);
    await fastify.register(redis_js_1.default);
    await fastify.register(broker_js_1.default);
    // Routes
    await fastify.register(health_js_1.default);
    // XTM-compatible routes
    await fastify.register(projects_js_1.default);
    await fastify.register(files_js_1.default);
    await fastify.register(costs_js_1.default);
    // Admin routes
    await fastify.register(projects_js_2.default);
    await fastify.register(jobs_js_1.default);
    await fastify.register(segments_js_1.default);
    await fastify.register(callbacks_js_1.default);
    await fastify.register(customers_js_1.default);
    await fastify.register(templates_js_1.default);
    await fastify.register(freelancers_js_1.default);
    await fastify.register(tm_js_1.default);
    await fastify.register(trainingData_js_1.default);
    return fastify;
}
