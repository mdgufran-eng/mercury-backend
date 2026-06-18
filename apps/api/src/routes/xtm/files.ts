import { FastifyPluginAsync } from 'fastify';

const xtmFileRoutes: FastifyPluginAsync = async (fastify) => {
  const BASE = '/project-manager-api-rest/projects/:projectId';

  // POST /project-manager-api-rest/projects/:projectId/files — upload source files
  fastify.post<{ Params: { projectId: string } }>(`${BASE}/files`, async (_request, reply) => {
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: accept multipart upload, store to MinIO, create Job record, trigger analysis',
    });
  });

  // GET /project-manager-api-rest/projects/:projectId/files/status — analysis status
  fastify.get<{ Params: { projectId: string } }>(`${BASE}/files/status`, async (_request, reply) => {
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: return analysis/word-count status for all jobs in the project',
    });
  });

  // GET /project-manager-api-rest/projects/:projectId/files/download — download target zip
  fastify.get<{ Params: { projectId: string } }>(`${BASE}/files/download`, async (_request, reply) => {
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: fetch translated files from MinIO, zip, stream response',
    });
  });

  // PUT /project-manager-api-rest/projects/:projectId/files — reanalyze
  fastify.put<{ Params: { projectId: string } }>(`${BASE}/files`, async (_request, reply) => {
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: re-upload source file and trigger fresh analysis + translation',
    });
  });
};

export default xtmFileRoutes;
