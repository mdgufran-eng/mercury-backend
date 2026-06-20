"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@mercury/core");
const adminCustomerRoutes = async (fastify) => {
    // GET /admin/api/customers?type=HUMAN|MACHINE|PAYLOAD&limit=50&skip=0
    fastify.get('/admin/api/customers', async (request, reply) => {
        const q = request.query;
        const filter = {};
        if (q.type)
            filter['type'] = q.type.toUpperCase();
        const limit = Math.min(parseInt(q.limit ?? '50', 10), 200);
        const skip = parseInt(q.skip ?? '0', 10);
        const db = fastify.mongo;
        const [data, total] = await Promise.all([
            core_1.Collections.customers(db).find(filter).skip(skip).limit(limit).toArray(),
            core_1.Collections.customers(db).countDocuments(filter),
        ]);
        return reply.send({ data, total, limit, skip });
    });
    // POST /admin/api/customers — create customer
    fastify.post('/admin/api/customers', async (request, reply) => {
        const body = request.body;
        const db = fastify.mongo;
        const customerId = await (0, core_1.nextId)(db, 'customer');
        const customer = {
            customerId,
            name: body.name,
            type: body.type,
            createdAt: new Date(),
        };
        await core_1.Collections.customers(db).insertOne(customer);
        return reply.status(201).send(customer);
    });
};
exports.default = adminCustomerRoutes;
