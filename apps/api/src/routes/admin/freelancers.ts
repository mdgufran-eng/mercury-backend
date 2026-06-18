import { FastifyPluginAsync } from 'fastify';

const adminFreelancerRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/freelancers — list freelancers
  fastify.get('/admin/freelancers', async (_request, reply) => {
    // TODO: fetch freelancers from MongoDB
    return reply.send({ data: [], total: 0 });
  });

  // POST /admin/freelancers — create freelancer
  fastify.post('/admin/freelancers', async (_request, reply) => {
    // TODO: validate body, generate freelancerId via nextId(), persist to MongoDB
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: create freelancer',
    });
  });
};

export default adminFreelancerRoutes;
