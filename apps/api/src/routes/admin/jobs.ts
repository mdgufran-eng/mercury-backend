import { FastifyPluginAsync } from 'fastify';

const adminJobRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/jobs/:id — get job by id
  fastify.get<{ Params: { id: string } }>('/admin/jobs/:id', async (_request, reply) => {
    // TODO: fetch job by jobId from MongoDB
    return reply.status(404).send({ error: 'Not Found', message: 'TODO: fetch job by id' });
  });
};

export default adminJobRoutes;
