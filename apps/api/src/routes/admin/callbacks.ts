import { FastifyPluginAsync } from 'fastify';

const adminCallbackRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/callbacks — list callback logs
  fastify.get('/admin/callbacks', async (_request, reply) => {
    // TODO: fetch callback logs with optional ?projectId=&success= filters
    return reply.send({ data: [], total: 0 });
  });

  // POST /admin/callbacks/:id/resend — re-enqueue a failed callback
  fastify.post<{ Params: { id: string } }>('/admin/callbacks/:id/resend', async (_request, reply) => {
    // TODO: look up callbackLog, enqueue webhook job with existing payload
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: resend callback by callbackId',
    });
  });
};

export default adminCallbackRoutes;
