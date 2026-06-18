import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
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

export default fp(errorHandlerPlugin, { name: 'errorHandler' });
