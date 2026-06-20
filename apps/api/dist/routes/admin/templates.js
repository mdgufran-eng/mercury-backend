"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@mercury/core");
const adminTemplateRoutes = async (fastify) => {
    // GET /admin/api/templates?method=MACHINE|HUMAN&targetLanguage=DE&limit=50&skip=0
    fastify.get('/admin/api/templates', async (request, reply) => {
        const q = request.query;
        const filter = {};
        if (q.method)
            filter['method'] = q.method.toUpperCase();
        if (q.targetLanguage)
            filter['targetLanguage'] = q.targetLanguage.toLowerCase();
        const limit = Math.min(parseInt(q.limit ?? '50', 10), 200);
        const skip = parseInt(q.skip ?? '0', 10);
        const db = fastify.mongo;
        const [data, total] = await Promise.all([
            core_1.Collections.templates(db).find(filter).skip(skip).limit(limit).toArray(),
            core_1.Collections.templates(db).countDocuments(filter),
        ]);
        return reply.send({ data, total, limit, skip });
    });
    // POST /admin/api/templates — upsert template (use provided templateId or mint one)
    fastify.post('/admin/api/templates', async (request, reply) => {
        const body = request.body;
        const db = fastify.mongo;
        const templateId = body.templateId ?? (await (0, core_1.nextId)(db, 'template'));
        const template = {
            templateId,
            name: body.name,
            sourceLanguage: body.sourceLanguage.toUpperCase(),
            targetLanguage: body.targetLanguage.toLowerCase(),
            method: body.method,
            createdAt: new Date(),
        };
        await core_1.Collections.templates(db).updateOne({ templateId }, { $set: template }, { upsert: true });
        return reply.status(201).send(template);
    });
};
exports.default = adminTemplateRoutes;
