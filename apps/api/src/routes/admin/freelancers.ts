import { FastifyPluginAsync } from 'fastify';
import { Collections, nextId } from '@mercury/core';
import type { Freelancer } from '@mercury/core';

const adminFreelancerRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/api/freelancers?lang=DE&limit=50&skip=0
  fastify.get('/admin/api/freelancers', async (request, reply) => {
    const q = request.query as { lang?: string; limit?: string; skip?: string };
    const filter: Record<string, unknown> = {};
    if (q.lang) filter['languages'] = q.lang.toLowerCase();

    const limit = Math.min(parseInt(q.limit ?? '50', 10), 200);
    const skip = parseInt(q.skip ?? '0', 10);
    const db = fastify.mongo;

    const [data, total] = await Promise.all([
      Collections.freelancers(db).find(filter).skip(skip).limit(limit).toArray(),
      Collections.freelancers(db).countDocuments(filter),
    ]);

    return reply.send({ data, total, limit, skip });
  });

  // POST /admin/api/freelancers — create freelancer
  fastify.post('/admin/api/freelancers', async (request, reply) => {
    const body = request.body as {
      name: string;
      email: string;
      languages: string[];
      ratePerWord: number;
      currency?: string;
    };

    const db = fastify.mongo;
    const freelancerId = await nextId(db, 'freelancer');

    const freelancer: Freelancer = {
      freelancerId,
      name: body.name,
      email: body.email,
      languages: body.languages.map((l) => l.toLowerCase()),
      ratePerWord: body.ratePerWord,
      currency: body.currency ?? 'USD',
      createdAt: new Date(),
    };

    await Collections.freelancers(db).insertOne(freelancer);
    return reply.status(201).send(freelancer);
  });

  // PUT /admin/api/freelancers/:freelancerId — update freelancer
  fastify.put<{ Params: { freelancerId: string } }>(
    '/admin/api/freelancers/:freelancerId',
    async (request, reply) => {
      const freelancerId = parseInt(request.params.freelancerId, 10);
      const body = request.body as Partial<{
        name: string;
        email: string;
        languages: string[];
        ratePerWord: number;
        currency: string;
      }>;

      const db = fastify.mongo;
      const update: Record<string, unknown> = {};
      if (body.name !== undefined) update['name'] = body.name;
      if (body.email !== undefined) update['email'] = body.email;
      if (body.languages !== undefined) update['languages'] = body.languages.map((l) => l.toLowerCase());
      if (body.ratePerWord !== undefined) update['ratePerWord'] = body.ratePerWord;
      if (body.currency !== undefined) update['currency'] = body.currency;

      const result = await Collections.freelancers(db).findOneAndUpdate(
        { freelancerId },
        { $set: update },
        { returnDocument: 'after' },
      );

      if (!result) return reply.status(404).send({ error: 'Freelancer not found' });
      return reply.send(result);
    },
  );
};

export default adminFreelancerRoutes;
