import { FastifyPluginAsync } from 'fastify';

const xtmProjectRoutes: FastifyPluginAsync = async (fastify) => {
  const BASE = '/project-manager-api-rest/projects';

  // POST /project-manager-api-rest/projects — create project
  fastify.post(BASE, async (_request, reply) => {
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: create project — parse body, generate projectId via nextId(), persist to MongoDB, enqueue translate job',
    });
  });

  // GET /project-manager-api-rest/projects — search projects (query: name, ids)
  fastify.get(BASE, async (_request, reply) => {
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: search projects — support ?name=&ids= query params, return XTM-compatible project list',
    });
  });

  // GET /project-manager-api-rest/projects/:projectId — get project status
  fastify.get<{ Params: { projectId: string } }>(`${BASE}/:projectId`, async (_request, reply) => {
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: get project by projectId, return status and job summary',
    });
  });

  // DELETE /project-manager-api-rest/projects/:projectId — delete project
  fastify.delete<{ Params: { projectId: string } }>(`${BASE}/:projectId`, async (_request, reply) => {
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: soft-delete project, cancel any in-flight jobs',
    });
  });

  // GET /project-manager-api-rest/projects/:projectId/users — get project users
  fastify.get<{ Params: { projectId: string } }>(`${BASE}/:projectId/users`, async (_request, reply) => {
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: return users/freelancers assigned to the project',
    });
  });
};

export default xtmProjectRoutes;
