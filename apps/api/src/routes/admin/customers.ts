import { FastifyPluginAsync } from 'fastify';

const adminCustomerRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/customers — list customers
  fastify.get('/admin/customers', async (_request, reply) => {
    // TODO: fetch customers from MongoDB
    return reply.send({ data: [], total: 0 });
  });

  // POST /admin/customers — create customer
  fastify.post('/admin/customers', async (_request, reply) => {
    // TODO: validate body, generate customerId via nextId(), persist to MongoDB
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: create customer',
    });
  });
};

export default adminCustomerRoutes;
