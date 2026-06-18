import { FastifyPluginAsync } from 'fastify';
import { Collections, nextId } from '@mercury/core';
import type { Customer } from '@mercury/core';

const adminCustomerRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/api/customers?type=HUMAN|MACHINE|PAYLOAD&limit=50&skip=0
  fastify.get('/admin/api/customers', async (request, reply) => {
    const q = request.query as { type?: string; limit?: string; skip?: string };
    const filter: Record<string, unknown> = {};
    if (q.type) filter['type'] = q.type.toUpperCase();

    const limit = Math.min(parseInt(q.limit ?? '50', 10), 200);
    const skip = parseInt(q.skip ?? '0', 10);
    const db = fastify.mongo;

    const [data, total] = await Promise.all([
      Collections.customers(db).find(filter).skip(skip).limit(limit).toArray(),
      Collections.customers(db).countDocuments(filter),
    ]);

    return reply.send({ data, total, limit, skip });
  });

  // POST /admin/api/customers — create customer
  fastify.post('/admin/api/customers', async (request, reply) => {
    const body = request.body as { name: string; type?: 'HUMAN' | 'MACHINE' | 'PAYLOAD' };
    const db = fastify.mongo;
    const customerId = await nextId(db, 'customer');

    const customer: Customer = {
      customerId,
      name: body.name,
      type: body.type,
      createdAt: new Date(),
    };

    await Collections.customers(db).insertOne(customer);
    return reply.status(201).send(customer);
  });
};

export default adminCustomerRoutes;
