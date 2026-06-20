"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const errorHandlerPlugin = async (fastify) => {
    fastify.setErrorHandler((error, _request, reply) => {
        const statusCode = error.statusCode ?? 500;
        if (statusCode >= 500) {
            fastify.log.error({ err: error }, 'Unhandled error');
        }
        // Normalize all error responses to {error, statusCode, code?}
        reply.status(statusCode).send({
            error: error.message ?? 'Internal Server Error',
            statusCode,
            ...(error.code ? { code: error.code } : {}),
        });
    });
    fastify.setNotFoundHandler((_request, reply) => {
        reply.status(404).send({ error: 'Route not found', statusCode: 404 });
    });
};
exports.default = (0, fastify_plugin_1.default)(errorHandlerPlugin, { name: 'errorHandler' });
