"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@mercury/core");
const adminFreelancerRoutes = async (fastify) => {
    // GET /admin/api/freelancers?lang=DE&limit=50&skip=0
    fastify.get('/admin/api/freelancers', async (request, reply) => {
        const q = request.query;
        const filter = {};
        if (q.lang)
            filter['languages'] = q.lang.toLowerCase();
        const limit = Math.min(parseInt(q.limit ?? '50', 10), 200);
        const skip = parseInt(q.skip ?? '0', 10);
        const db = fastify.mongo;
        const [data, total] = await Promise.all([
            core_1.Collections.freelancers(db).find(filter).skip(skip).limit(limit).toArray(),
            core_1.Collections.freelancers(db).countDocuments(filter),
        ]);
        return reply.send({
            data: data.map((f) => ({ ...f, langs: f.languages })),
            total,
            limit,
            skip,
        });
    });
    // POST /admin/api/freelancers — create freelancer
    fastify.post('/admin/api/freelancers', async (request, reply) => {
        const body = request.body;
        const db = fastify.mongo;
        const freelancerId = await (0, core_1.nextId)(db, 'freelancer');
        const freelancer = {
            freelancerId,
            name: body.name,
            email: body.email,
            languages: body.languages.map((l) => l.toLowerCase()),
            ratePerWord: body.ratePerWord,
            currency: body.currency ?? 'USD',
            createdAt: new Date(),
        };
        await core_1.Collections.freelancers(db).insertOne(freelancer);
        return reply.status(201).send(freelancer);
    });
    // PUT /admin/api/freelancers/:freelancerId — update freelancer
    fastify.put('/admin/api/freelancers/:freelancerId', async (request, reply) => {
        const freelancerId = parseInt(request.params.freelancerId, 10);
        const body = request.body;
        const db = fastify.mongo;
        const update = {};
        if (body.name !== undefined)
            update['name'] = body.name;
        if (body.email !== undefined)
            update['email'] = body.email;
        if (body.languages !== undefined)
            update['languages'] = body.languages.map((l) => l.toLowerCase());
        if (body.ratePerWord !== undefined)
            update['ratePerWord'] = body.ratePerWord;
        if (body.currency !== undefined)
            update['currency'] = body.currency;
        const result = await core_1.Collections.freelancers(db).findOneAndUpdate({ freelancerId }, { $set: update }, { returnDocument: 'after' });
        if (!result)
            return reply.status(404).send({ error: 'Freelancer not found' });
        return reply.send(result);
    });
};
exports.default = adminFreelancerRoutes;
