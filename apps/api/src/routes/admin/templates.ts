import { FastifyPluginAsync } from 'fastify';

const adminTemplateRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/templates — list templates
  fastify.get('/admin/templates', async (_request, reply) => {
    // TODO: fetch templates from MongoDB
    return reply.send({ data: [], total: 0 });
  });

  // POST /admin/templates — create template
  fastify.post('/admin/templates', async (_request, reply) => {
    // TODO: validate body, generate templateId via nextId(), persist to MongoDB
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: create template',
    });
  });
};

export default adminTemplateRoutes;
