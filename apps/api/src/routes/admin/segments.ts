import { FastifyPluginAsync } from 'fastify';

const adminSegmentRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/jobs/:id/segments — list segments for a job
  fastify.get<{ Params: { id: string } }>('/admin/jobs/:id/segments', async (_request, reply) => {
    // TODO: fetch segments by jobId from MongoDB, support pagination
    return reply.send({ data: [], total: 0 });
  });
};

export default adminSegmentRoutes;
