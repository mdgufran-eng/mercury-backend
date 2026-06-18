import { FastifyPluginAsync } from 'fastify';
import { Collections, nextId } from '@mercury/core';
import type { Template } from '@mercury/core';

const adminTemplateRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/api/templates?method=MACHINE|HUMAN&targetLanguage=DE&limit=50&skip=0
  fastify.get('/admin/api/templates', async (request, reply) => {
    const q = request.query as {
      method?: string;
      targetLanguage?: string;
      limit?: string;
      skip?: string;
    };

    const filter: Record<string, unknown> = {};
    if (q.method) filter['method'] = q.method.toUpperCase();
    if (q.targetLanguage) filter['targetLanguage'] = q.targetLanguage.toLowerCase();

    const limit = Math.min(parseInt(q.limit ?? '50', 10), 200);
    const skip = parseInt(q.skip ?? '0', 10);
    const db = fastify.mongo;

    const [data, total] = await Promise.all([
      Collections.templates(db).find(filter).skip(skip).limit(limit).toArray(),
      Collections.templates(db).countDocuments(filter),
    ]);

    return reply.send({ data, total, limit, skip });
  });

  // POST /admin/api/templates — upsert template (use provided templateId or mint one)
  fastify.post('/admin/api/templates', async (request, reply) => {
    const body = request.body as {
      templateId?: number;
      name: string;
      sourceLanguage: string;
      targetLanguage: string;
      method: 'MACHINE' | 'HUMAN';
    };

    const db = fastify.mongo;
    const templateId = body.templateId ?? (await nextId(db, 'template'));

    const template: Template = {
      templateId,
      name: body.name,
      sourceLanguage: body.sourceLanguage.toUpperCase(),
      targetLanguage: body.targetLanguage.toLowerCase(),
      method: body.method,
      createdAt: new Date(),
    };

    await Collections.templates(db).updateOne(
      { templateId },
      { $set: template },
      { upsert: true },
    );

    return reply.status(201).send(template);
  });
};

export default adminTemplateRoutes;
