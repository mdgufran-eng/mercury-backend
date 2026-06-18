import { FastifyPluginAsync } from 'fastify';

const adminTmRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/tm — search translation memory
  fastify.get('/admin/tm', async (_request, reply) => {
    // TODO: support ?sourceLanguage=&targetLanguage=&q= query params
    return reply.send({ data: [], total: 0 });
  });

  // POST /admin/tm/import — bulk import TM entries
  fastify.post('/admin/tm/import', async (_request, reply) => {
    // TODO: accept JSON array of TMEntry, upsert into MongoDB translationMemory collection
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'TODO: bulk import TM entries from JSON body',
    });
  });
};

export default adminTmRoutes;
