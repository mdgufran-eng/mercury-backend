"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jszip_1 = __importDefault(require("jszip"));
const core_1 = require("@mercury/core");
const crypto_1 = require("crypto");
const BASE = '/project-manager-api-rest/projects/:projectId';
const xtmFileRoutes = async (fastify) => {
    // GET /:projectId/files/status — legacy path kept for compatibility; analysis is always FINISHED
    fastify.get(`${BASE}/files/status`, async (request, reply) => {
        const projectId = parseInt(request.params.projectId, 10);
        const jobs = await core_1.Collections.jobs(fastify.mongo).find({ projectId }).toArray();
        if (jobs.length === 0)
            return reply.status(404).send({ error: 'No jobs found for project' });
        return reply.send({
            projectId,
            status: 'FINISHED',
            jobs: jobs.map((j) => ({
                jobId: j.jobId,
                fileName: j.fileName,
                status: 'FINISHED',
            })),
        });
    });
    // POST /:projectId/files/sources/upload — upload additional / replacement source files
    // rosetta sends files as `files[N].file` parts; matchType = "MATCH_NAMES" form field
    fastify.post(`${BASE}/files/sources/upload`, async (request, reply) => {
        const projectId = parseInt(request.params.projectId, 10);
        const db = fastify.mongo;
        const project = await core_1.Collections.projects(db).findOne({ projectId });
        if (!project)
            return reply.status(404).send({ error: 'Project not found' });
        const fields = {};
        const files = [];
        for await (const part of request.parts()) {
            if (part.type === 'field') {
                fields[part.fieldname] = part.value;
            }
            else {
                const buffer = await part.toBuffer();
                files.push({ fieldname: part.fieldname, filename: part.filename, buffer });
            }
        }
        const broker = fastify.broker;
        const now = new Date();
        const jobResults = [];
        for (const f of files) {
            const sourceHash = (0, crypto_1.createHash)('sha256').update(f.buffer).digest('hex');
            let sourceContent = {};
            try {
                sourceContent = JSON.parse(f.buffer.toString('utf-8'));
            }
            catch {
                // non-JSON
            }
            const existing = await core_1.Collections.jobs(db).findOne({ projectId, fileName: f.filename });
            if (existing) {
                if (existing.sourceHash !== sourceHash) {
                    // Snapshot existing translations before clearing so worker reuses unchanged sentences (Fix 5)
                    const existingSegs = await core_1.Collections.segments(db)
                        .find({ jobId: existing.jobId, state: 'APPROVED' })
                        .toArray();
                    const segmentCache = {};
                    for (const s of existingSegs) {
                        if (s.target)
                            segmentCache[s.sourceHash] = s.target;
                    }
                    await core_1.Collections.segments(db).deleteMany({ jobId: existing.jobId });
                    await core_1.Collections.jobs(db).updateOne({ jobId: existing.jobId }, {
                        $set: {
                            sourceHash,
                            sourceContent,
                            targetContent: undefined,
                            status: 'CREATED',
                            wordCount: 0,
                            billableWords: 0,
                            segmentCache,
                            updatedAt: now,
                        },
                    });
                    await broker.enqueueTranslate({
                        projectId,
                        jobId: existing.jobId,
                        sourceLanguage: project.sourceLanguage,
                        targetLanguage: project.targetLanguage,
                    });
                    if (project.callbackUrls?.sourceFileUpdated) {
                        const req = (0, core_1.buildSourceFileUpdatedWebhook)(project.callbackUrls.sourceFileUpdated, projectId);
                        const callbackId = await (0, core_1.nextId)(db, 'callback');
                        await core_1.Collections.callbackLogs(db).insertOne({
                            callbackId,
                            projectId,
                            jobId: existing.jobId,
                            event: 'source-file-updated',
                            url: req.url,
                            method: req.method,
                            headers: req.headers,
                            body: req.body,
                            payload: {},
                            attempts: 0,
                            success: false,
                            createdAt: now,
                        });
                        await broker.enqueueWebhook({
                            callbackId,
                            projectId,
                            jobId: existing.jobId,
                            customerId: project.customerId,
                            event: 'source-file-updated',
                            url: req.url,
                            method: req.method,
                            headers: req.headers,
                            body: req.body,
                        });
                    }
                }
                jobResults.push({ jobId: existing.jobId, fileName: f.filename, action: 'replaced' });
            }
            else {
                const jobId = await (0, core_1.nextId)(db, 'job');
                const job = {
                    jobId,
                    projectId,
                    fileName: f.filename,
                    sourceFileKey: `projects/${projectId}/jobs/${jobId}/source/${f.filename}`,
                    status: 'CREATED',
                    wordCount: 0,
                    billableWords: 0,
                    sourceHash,
                    sourceContent,
                    createdAt: now,
                    updatedAt: now,
                };
                await core_1.Collections.jobs(db).insertOne(job);
                await broker.enqueueTranslate({
                    projectId,
                    jobId,
                    sourceLanguage: project.sourceLanguage,
                    targetLanguage: project.targetLanguage,
                });
                jobResults.push({ jobId, fileName: f.filename, action: 'created' });
            }
        }
        return reply.status(201).send({ projectId, jobs: jobResults });
    });
    // GET /:projectId/files/download?fileType=TARGET[&jobIds=123,456]
    // Each file in the zip preserves rosetta's {content, metadata} envelope byte-for-byte.
    fastify.get(`${BASE}/files/download`, async (request, reply) => {
        const projectId = parseInt(request.params.projectId, 10);
        const db = fastify.mongo;
        const project = await core_1.Collections.projects(db).findOne({ projectId });
        if (!project)
            return reply.status(404).send({ error: 'Project not found' });
        let jobFilter = { projectId };
        if (request.query.jobIds) {
            const ids = request.query.jobIds
                .split(',')
                .map((s) => parseInt(s.trim(), 10))
                .filter((n) => !isNaN(n));
            jobFilter = { projectId, jobId: { $in: ids } };
        }
        const jobs = (await core_1.Collections.jobs(db).find(jobFilter).toArray());
        const unfinished = jobs.filter((j) => j.status !== 'FINISHED');
        if (unfinished.length > 0) {
            return reply.status(409).send({
                error: 'Not all jobs are finished',
                pending: unfinished.map((j) => j.jobId),
            });
        }
        const zip = new jszip_1.default();
        for (const job of jobs) {
            const source = (job.sourceContent ?? {});
            const isRosettaFile = source['content'] !== null &&
                typeof source['content'] === 'object' &&
                source['metadata'] !== undefined;
            let zipEntry;
            if (isRosettaFile) {
                // Preserve original metadata, swap content with translated version
                zipEntry = {
                    content: job.targetContent?.['content']
                        ?? job.targetContent
                        ?? source['content'],
                    metadata: source['metadata'],
                };
            }
            else {
                zipEntry = {
                    content: job.targetContent ?? source,
                    metadata: {
                        jobId: job.jobId,
                        projectId,
                        fileName: job.fileName,
                        sourceLanguage: project.sourceLanguage,
                        targetLanguage: project.targetLanguage,
                    },
                };
            }
            zip.file(job.fileName, JSON.stringify(zipEntry));
        }
        const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
        reply.header('Content-Type', 'application/zip');
        reply.header('Content-Disposition', `attachment; filename="project-${projectId}-translations.zip"`);
        return reply.send(buffer);
    });
    // PUT /:projectId/files — reanalyze: re-translate all jobs (snapshot segment cache first)
    fastify.put(`${BASE}/files`, async (request, reply) => {
        const projectId = parseInt(request.params.projectId, 10);
        const db = fastify.mongo;
        const project = await core_1.Collections.projects(db).findOne({ projectId });
        if (!project)
            return reply.status(404).send({ error: 'Project not found' });
        const jobs = await core_1.Collections.jobs(db).find({ projectId }).toArray();
        const now = new Date();
        for (const job of jobs) {
            const existingSegs = await core_1.Collections.segments(db)
                .find({ jobId: job.jobId, state: 'APPROVED' })
                .toArray();
            const segmentCache = {};
            for (const s of existingSegs) {
                if (s.target)
                    segmentCache[s.sourceHash] = s.target;
            }
            await core_1.Collections.segments(db).deleteMany({ jobId: job.jobId });
            await core_1.Collections.jobs(db).updateOne({ jobId: job.jobId }, { $set: { status: 'CREATED', targetContent: undefined, billableWords: 0, segmentCache, updatedAt: now } });
            await fastify.broker.enqueueTranslate({
                projectId,
                jobId: job.jobId,
                sourceLanguage: project.sourceLanguage,
                targetLanguage: project.targetLanguage,
            });
        }
        await core_1.Collections.projects(db).updateOne({ projectId }, { $set: { status: 'CREATED', updatedAt: now } });
        return reply.send({ success: true });
    });
};
exports.default = xtmFileRoutes;
