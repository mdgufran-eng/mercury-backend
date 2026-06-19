import { FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Root → redirect to Mercury UI
  fastify.get('/', async (_request, reply) => {
    return reply.redirect('http://localhost:5173', 302);
  });

  fastify.get('/health', async (_request, _reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
};

export default healthRoutes;
