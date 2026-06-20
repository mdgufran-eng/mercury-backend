"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@mercury/core");
const adminSegmentRoutes = async (fastify) => {
    // GET /admin/api/projects/:projectId/segments?jobId=&fieldKey=&matchType=&state=&limit=&skip=
    fastify.get('/admin/api/projects/:projectId/segments', async (request, reply) => {
        const projectId = parseInt(request.params.projectId, 10);
        const q = request.query;
        const filter = { projectId };
        if (q.jobId)
            filter['jobId'] = parseInt(q.jobId, 10);
        if (q.fieldKey)
            filter['fieldKey'] = q.fieldKey;
        if (q.matchType)
            filter['matchType'] = q.matchType;
        if (q.state)
            filter['state'] = q.state;
        const limit = Math.min(parseInt(q.limit ?? '50', 10), 200);
        const skip = parseInt(q.skip ?? '0', 10);
        const db = fastify.mongo;
        const [data, total] = await Promise.all([
            core_1.Collections.segments(db)
                .find(filter)
                .sort({ fieldKey: 1, index: 1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            core_1.Collections.segments(db).countDocuments(filter),
        ]);
        return reply.send({ data, total, limit, skip });
    });
    // PUT /admin/api/projects/:projectId/segments/:segmentId — edit target (human translation)
    fastify.put('/admin/api/projects/:projectId/segments/:segmentId', async (request, reply) => {
        const projectId = parseInt(request.params.projectId, 10);
        const segmentId = parseInt(request.params.segmentId, 10);
        const { target } = request.body;
        const db = fastify.mongo;
        const result = await core_1.Collections.segments(db).findOneAndUpdate({ segmentId, projectId }, { $set: { target, state: 'TRANSLATED', updatedAt: new Date() } }, { returnDocument: 'after' });
        if (!result)
            return reply.status(404).send({ error: 'Segment not found' });
        return reply.send({ success: true, segmentId });
    });
    // POST /admin/api/projects/:projectId/segments/:segmentId/approve
    fastify.post('/admin/api/projects/:projectId/segments/:segmentId/approve', async (request, reply) => {
        const projectId = parseInt(request.params.projectId, 10);
        const segmentId = parseInt(request.params.segmentId, 10);
        const db = fastify.mongo;
        const segment = (await core_1.Collections.segments(db).findOne({
            segmentId,
            projectId,
        }));
        if (!segment)
            return reply.status(404).send({ error: 'Segment not found' });
        if (!segment.target)
            return reply.status(422).send({ errors: [{ code: 'NO_TARGET', message: 'Segment has no target translation' }] });
        if (segment.state === 'APPROVED')
            return reply.send({ success: true, segmentId, alreadyApproved: true });
        const qaResult = core_1.QA.runQA(segment.source, segment.target);
        if (!qaResult.passed) {
            return reply.status(422).send({ errors: qaResult.errors });
        }
        // Write approved translation to MongoDB TM so future projects get it for free
        const project = await core_1.Collections.projects(db).findOne({ projectId });
        if (project) {
            await core_1.MongoTM.store(db, segment.source, segment.target, project.sourceLanguage, project.targetLanguage).catch(() => { });
        }
        await core_1.Collections.segments(db).updateOne({ segmentId, projectId }, { $set: { state: 'APPROVED', approved: true, locked: true, updatedAt: new Date() } });
        return reply.send({ success: true, segmentId });
    });
};
exports.default = adminSegmentRoutes;
