import { FastifyPluginAsync } from 'fastify';

const xtmCostRoutes: FastifyPluginAsync = async (fastify) => {
  const BASE = '/project-manager-api-rest/projects/:projectId';

  // POST /project-manager-api-rest/projects/:projectId/costs — generate costs
  fastify.post<{ Params: { projectId: string } }>(`${BASE}/costs`, async (_request, reply) => {
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: compute costs based on billableWords + rate card, persist cost record, enqueue cost-po job',
    });
  });

  // GET /project-manager-api-rest/projects/:projectId/custom-fields — get custom fields
  fastify.get<{ Params: { projectId: string } }>(`${BASE}/custom-fields`, async (_request, reply) => {
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: return custom field definitions for this project/template',
    });
  });

  // POST /project-manager-api-rest/projects/:projectId/purchase-orders — generate PO
  fastify.post<{ Params: { projectId: string } }>(`${BASE}/purchase-orders`, async (_request, reply) => {
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: generate purchase order PDF/CSV, store to MinIO, return PO reference',
    });
  });

  // GET /project-manager-api-rest/projects/:projectId/purchase-orders/download — download PO
  fastify.get<{ Params: { projectId: string } }>(`${BASE}/purchase-orders/download`, async (_request, reply) => {
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: stream PO file from MinIO',
    });
  });
};

export default xtmCostRoutes;
