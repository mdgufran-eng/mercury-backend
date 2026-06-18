import { FastifyPluginAsync } from 'fastify';

const adminProjectRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/projects — list all projects
  fastify.get('/admin/projects', async (_request, reply) => {
    // TODO: paginate projects from MongoDB
    return reply.send({ data: [], total: 0 });
  });

  // GET /admin/projects/:id — get project by id
  fastify.get<{ Params: { id: string } }>('/admin/projects/:id', async (_request, reply) => {
    // TODO: fetch project by projectId from MongoDB
    return reply.status(404).send({ error: 'Not Found', message: 'TODO: fetch project by id' });
  });
};

export default adminProjectRoutes;
