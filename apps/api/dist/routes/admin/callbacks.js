"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@mercury/core");
const adminCallbackRoutes = async (fastify) => {
    // GET /admin/api/callbacks?projectId=&success=&limit=&skip=
    fastify.get('/admin/api/callbacks', async (request, reply) => {
        const q = request.query;
        const filter = {};
        if (q.projectId)
            filter['projectId'] = parseInt(q.projectId, 10);
        if (q.success !== undefined)
            filter['success'] = q.success === 'true';
        const limit = Math.min(parseInt(q.limit ?? '50', 10), 200);
        const skip = parseInt(q.skip ?? '0', 10);
        const db = fastify.mongo;
        const [data, total] = await Promise.all([
            core_1.Collections.callbackLogs(db).find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            core_1.Collections.callbackLogs(db).countDocuments(filter),
        ]);
        const projectIds = [...new Set(data.map((c) => c.projectId))];
        const jobIds = [...new Set(data.map((c) => c.jobId).filter((id) => id != null))];
        const [projects, jobs] = await Promise.all([
            core_1.Collections.projects(db).find({ projectId: { $in: projectIds } }).toArray(),
            jobIds.length > 0 ? core_1.Collections.jobs(db).find({ jobId: { $in: jobIds } }).toArray() : Promise.resolve([]),
        ]);
        const projMap = new Map(projects.map((p) => [p.projectId, p.name]));
        const jobMap = new Map(jobs.map((j) => [j.jobId, j.fileName]));
        return reply.send({
            data: data.map((c) => ({
                id: String(c.callbackId),
                callbackId: c.callbackId,
                projectId: String(c.projectId),
                projectName: projMap.get(c.projectId) ?? String(c.projectId),
                jobId: c.jobId ? String(c.jobId) : null,
                jobFileName: c.jobId ? (jobMap.get(c.jobId) ?? null) : null,
                event: c.event,
                url: c.url,
                method: c.method,
                success: c.success,
                statusCode: c.responseStatus ?? 0,
                attempts: c.attempts,
                sentAt: c.lastAttemptAt?.toISOString() ?? c.createdAt.toISOString(),
                body: c.body ?? null,
            })),
            total,
            limit,
            skip,
        });
    });
    // POST /admin/api/callbacks/:id/resend — re-enqueue a failed callback
    fastify.post('/admin/api/callbacks/:id/resend', async (request, reply) => {
        const callbackId = parseInt(request.params.id, 10);
        const db = fastify.mongo;
        const log = await core_1.Collections.callbackLogs(db).findOne({ callbackId });
        if (!log)
            return reply.status(404).send({ error: 'Callback log not found' });
        // Reset state and re-enqueue
        await core_1.Collections.callbackLogs(db).updateOne({ callbackId }, { $set: { success: false, responseStatus: undefined } });
        await fastify.broker.enqueueWebhook({
            callbackId: log.callbackId,
            projectId: log.projectId,
            jobId: log.jobId,
            event: log.event,
            url: log.url,
            method: log.method,
            headers: log.headers,
            body: log.body,
        });
        return reply.send({ success: true, callbackId });
    });
};
exports.default = adminCallbackRoutes;
