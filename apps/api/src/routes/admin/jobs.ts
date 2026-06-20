import { FastifyPluginAsync } from 'fastify';
import {
  Collections,
  nextId,
  buildJobFinishedWebhook,
  buildProjectCompletionWebhook,
} from '@mercury/core';
import type { CallbackLog } from '@mercury/core';

const adminJobRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/api/projects/:projectId/jobs
  fastify.get<{ Params: { projectId: string }; Querystring: { limit?: string; skip?: string } }>(
    '/admin/api/projects/:projectId/jobs',
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const limit = Math.min(parseInt(request.query.limit ?? '50', 10), 200);
      const skip = parseInt(request.query.skip ?? '0', 10);
      const db = fastify.mongo;

      const proj = await Collections.projects(db).findOne({ projectId });
      if (!proj) return reply.status(404).send({ error: 'Project not found' });

      const [jobs, total] = await Promise.all([
        Collections.jobs(db).find({ projectId }).sort({ createdAt: 1 }).skip(skip).limit(limit).toArray(),
        Collections.jobs(db).countDocuments({ projectId }),
      ]);

      const segCounts = await Collections.segments(db)
        .aggregate<{ _id: number; count: number }>([
          { $match: { projectId } },
          { $group: { _id: '$jobId', count: { $sum: 1 } } },
        ])
        .toArray();
      const segCountMap = new Map(segCounts.map((s) => [s._id, s.count]));

      return reply.send({
        data: jobs.map((j) => ({
          id: String(j.jobId),
          jobId: j.jobId,
          projectId: j.projectId,
          fileName: j.fileName,
          sourceLang: proj.sourceLanguage,
          targetLang: proj.targetLanguage,
          status: j.status === 'CREATED' ? 'PENDING' : j.status === 'FINISHED' ? 'COMPLETED' : j.status,
          method: proj.method,
          wordCount: j.wordCount,
          billableWords: j.billableWords,
          sourceHash: j.sourceHash,
          segmentCount: segCountMap.get(j.jobId) ?? 0,
          completedAt: j.completedAt?.toISOString() ?? null,
          createdAt: j.createdAt.toISOString(),
          updatedAt: j.updatedAt.toISOString(),
        })),
        total,
        limit,
        skip,
      });
    },
  );

  // GET /admin/api/jobs/:jobId
  fastify.get<{ Params: { jobId: string } }>('/admin/api/jobs/:jobId', async (request, reply) => {
    const jobId = parseInt(request.params.jobId, 10);
    const db = fastify.mongo;

    const job = await Collections.jobs(db).findOne({ jobId });
    if (!job) return reply.status(404).send({ error: 'Job not found' });

    const [proj, segmentCount] = await Promise.all([
      Collections.projects(db).findOne({ projectId: job.projectId }),
      Collections.segments(db).countDocuments({ jobId: job.jobId }),
    ]);

    return reply.send({
      id: String(job.jobId),
      jobId: job.jobId,
      projectId: job.projectId,
      fileName: job.fileName,
      sourceContent: job.sourceContent ?? {},
      sourceHash: job.sourceHash,
      sourceLang: proj?.sourceLanguage ?? '',
      targetLang: proj?.targetLanguage ?? '',
      status: job.status === 'CREATED' ? 'PENDING' : job.status === 'FINISHED' ? 'COMPLETED' : job.status,
      method: proj?.method ?? 'MACHINE',
      wordCount: job.wordCount,
      billableWords: job.billableWords,
      segmentCount,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    });
  });

  // POST /admin/api/projects/:projectId/jobs — multipart file upload from frontend
  fastify.post<{ Params: { projectId: string } }>(
    '/admin/api/projects/:projectId/jobs',
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const db = fastify.mongo;
      const { createHash } = await import('node:crypto');

      const project = await Collections.projects(db).findOne({ projectId });
      if (!project) return reply.status(404).send({ error: 'Project not found' });

      const files: Array<{ filename: string; buffer: Buffer }> = [];
      for await (const part of request.parts()) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          files.push({ filename: part.filename, buffer });
        }
      }

      if (files.length === 0) return reply.status(400).send({ error: 'No files provided' });

      const now = new Date();
      const created: Array<{ jobId: number; fileName: string; action: 'created' | 'replaced' }> = [];

      for (const f of files) {
        const sourceHash = createHash('sha256').update(f.buffer).digest('hex');
        let sourceContent: Record<string, unknown> = {};
        try { sourceContent = JSON.parse(f.buffer.toString('utf-8')); } catch { /* non-JSON */ }

        const existing = await Collections.jobs(db).findOne({ projectId, fileName: f.filename });
        if (existing) {
          await resetAndEnqueueJob(fastify.broker, db, {
            projectId,
            jobId: existing.jobId,
            sourceLanguage: project.sourceLanguage,
            targetLanguage: project.targetLanguage,
            sourceHash,
            sourceContent,
            now,
          });
          created.push({ jobId: existing.jobId, fileName: f.filename, action: 'replaced' });
          continue;
        }

        const jobId = await nextId(db, 'job');
        const job: import('@mercury/core').Job = {
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
        await Collections.jobs(db).insertOne(job);
        await fastify.broker.enqueueTranslate({
          projectId,
          jobId,
          sourceLanguage: project.sourceLanguage,
          targetLanguage: project.targetLanguage,
        });
        created.push({ jobId, fileName: f.filename, action: 'created' });
      }

      // Update project status to ACTIVE if still CREATED
      if (project.status === 'CREATED') {
        await Collections.projects(db).updateOne(
          { projectId },
          { $set: { status: 'ACTIVE', updatedAt: now } },
        );
      }

      return reply.status(201).send({ projectId, jobs: created });
    },
  );

  // PUT /admin/api/projects/:projectId/jobs/:jobId — edit source filename/content and re-enqueue
  fastify.put<{
    Params: { projectId: string; jobId: string };
    Body: { fileName?: string; sourceContent?: Record<string, unknown> };
  }>(
    '/admin/api/projects/:projectId/jobs/:jobId',
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const jobId = parseInt(request.params.jobId, 10);
      const db = fastify.mongo;
      const { createHash } = await import('node:crypto');

      const [project, job] = await Promise.all([
        Collections.projects(db).findOne({ projectId }),
        Collections.jobs(db).findOne({ projectId, jobId }),
      ]);

      if (!project || !job) return reply.status(404).send({ error: 'Project or job not found' });

      const nextFileName = request.body.fileName?.trim() || job.fileName;
      if (!nextFileName) return reply.status(400).send({ error: 'fileName is required' });

      const sourceContent = request.body.sourceContent ?? job.sourceContent ?? {};
      if (
        sourceContent === null ||
        Array.isArray(sourceContent) ||
        typeof sourceContent !== 'object'
      ) {
        return reply.status(400).send({ error: 'sourceContent must be a JSON object' });
      }

      if (nextFileName !== job.fileName) {
        const duplicate = await Collections.jobs(db).findOne({ projectId, fileName: nextFileName });
        if (duplicate) {
          return reply.status(409).send({ error: 'A file with this name already exists in the project' });
        }
      }

      const now = new Date();
      const sourceHash = createHash('sha256')
        .update(JSON.stringify(sourceContent))
        .digest('hex');

      await resetAndEnqueueJob(fastify.broker, db, {
        projectId,
        jobId,
        sourceLanguage: project.sourceLanguage,
        targetLanguage: project.targetLanguage,
        fileName: nextFileName,
        sourceFileKey: `projects/${projectId}/jobs/${jobId}/source/${nextFileName}`,
        sourceHash,
        sourceContent,
        now,
      });

      return reply.send({ success: true, projectId, jobId, fileName: nextFileName });
    },
  );

  // DELETE /admin/api/projects/:projectId/jobs/:jobId — delete uploaded file/job
  fastify.delete<{ Params: { projectId: string; jobId: string } }>(
    '/admin/api/projects/:projectId/jobs/:jobId',
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const jobId = parseInt(request.params.jobId, 10);
      const db = fastify.mongo;

      const [project, job] = await Promise.all([
        Collections.projects(db).findOne({ projectId }),
        Collections.jobs(db).findOne({ projectId, jobId }),
      ]);

      if (!project || !job) return reply.status(404).send({ error: 'Project or job not found' });

      await Promise.all([
        Collections.segments(db).deleteMany({ projectId, jobId }),
        Collections.jobs(db).deleteOne({ projectId, jobId }),
      ]);

      const now = new Date();
      const remainingJobs = await Collections.jobs(db).find({ projectId }).toArray();
      let status: import('@mercury/core').ProjectStatus = 'CREATED';
      if (remainingJobs.length > 0) {
        status = remainingJobs.every((j) => j.status === 'FINISHED')
          ? 'FINISHED'
          : remainingJobs.some((j) => j.status === 'IN_PROGRESS')
            ? 'IN_PROGRESS'
            : 'ACTIVE';
      }
      await Collections.projects(db).updateOne(
        { projectId },
        { $set: { status, updatedAt: now } },
      );

      return reply.send({ success: true, projectId, jobId });
    },
  );

  // POST /admin/api/projects/:projectId/jobs/:jobId/retry — reset generated state and re-enqueue
  fastify.post<{ Params: { projectId: string; jobId: string } }>(
    '/admin/api/projects/:projectId/jobs/:jobId/retry',
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const jobId = parseInt(request.params.jobId, 10);
      const db = fastify.mongo;

      const [project, job] = await Promise.all([
        Collections.projects(db).findOne({ projectId }),
        Collections.jobs(db).findOne({ projectId, jobId }),
      ]);

      if (!project || !job) return reply.status(404).send({ error: 'Project or job not found' });

      await resetAndEnqueueJob(fastify.broker, db, {
        projectId,
        jobId,
        sourceLanguage: project.sourceLanguage,
        targetLanguage: project.targetLanguage,
        now: new Date(),
      });

      return reply.send({ success: true, projectId, jobId });
    },
  );

  // POST /admin/api/projects/:projectId/jobs/:jobId/complete
  // Human translator marks a job done — validates segments, reassembles target JSON,
  // fires job-finished + project-completion callbacks, auto-creates Cost + PO.
  fastify.post<{ Params: { projectId: string; jobId: string } }>(
    '/admin/api/projects/:projectId/jobs/:jobId/complete',
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const jobId = parseInt(request.params.jobId, 10);
      const db = fastify.mongo;

      const [project, job] = await Promise.all([
        Collections.projects(db).findOne({ projectId }),
        Collections.jobs(db).findOne({ jobId, projectId }),
      ]);

      if (!project || !job) return reply.status(404).send({ error: 'Project or job not found' });
      if (job.status === 'FINISHED') return reply.send({ success: true, alreadyComplete: true });

      // All segments must have a target before completing
      const segments = await Collections.segments(db).find({ jobId, projectId }).toArray();
      const missing = segments.filter((s) => !s.target || s.target.trim() === '');
      if (missing.length > 0) {
        return reply.status(422).send({
          error: `${missing.length} segment(s) have no target translation`,
          segmentIds: missing.map((s) => s.segmentId),
        });
      }

      // Reassemble target JSON from human-translated segment targets
      const byField = new Map<string, typeof segments>();
      for (const seg of segments) {
        const list = byField.get(seg.fieldKey) ?? [];
        list.push(seg);
        byField.set(seg.fieldKey, list);
      }

      const targetContent = structuredClone(job.sourceContent ?? {}) as Record<string, unknown>;

      function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
        const keys = path.split(/\.|\[(\d+)\]/).filter(Boolean);
        let cur: unknown = obj;
        for (let i = 0; i < keys.length - 1; i++) {
          const k = keys[i]!;
          cur = (cur as Record<string, unknown>)[k];
        }
        const lastKey = keys[keys.length - 1]!;
        (cur as Record<string, unknown>)[lastKey] = value;
      }

      for (const [fieldKey, segs] of byField) {
        segs.sort((a, b) => a.index - b.index);
        setPath(targetContent, fieldKey, segs.map((s) => s.target).join(' '));
      }

      const billableWords = segments.reduce(
        (sum, s) => sum + s.source.trim().split(/\s+/).filter(Boolean).length,
        0,
      );

      const now = new Date();

      await Collections.jobs(db).updateOne(
        { jobId },
        { $set: { targetContent, status: 'FINISHED', billableWords, completedAt: now, updatedAt: now } },
      );

      // Fire job-finished callback
      await fireCallback(db, fastify.broker, project.callbackUrls?.jobFinished, {
        projectId,
        jobId,
        customerId: project.customerId,
        event: 'job-finished',
        build: () => buildJobFinishedWebhook(project.callbackUrls!.jobFinished!, projectId, jobId, project.customerId),
        now,
      });

      // Check if all project jobs are finished
      const unfinished = await Collections.jobs(db).countDocuments({
        projectId,
        status: { $ne: 'FINISHED' },
      });

      if (unfinished === 0) {
        await Collections.projects(db).updateOne(
          { projectId },
          { $set: { status: 'FINISHED', updatedAt: now } },
        );

        await fireCallback(db, fastify.broker, project.callbackUrls?.projectCompletion, {
          projectId,
          customerId: project.customerId,
          event: 'project-completion',
          build: () =>
            buildProjectCompletionWebhook(
              project.callbackUrls!.projectCompletion!,
              projectId,
              project.customerId,
            ),
          now,
        });

        // Auto-create Cost + PO for HUMAN projects on full completion
        if (project.method === 'HUMAN') {
          let ratePerWord = 0.05;
          let freelancerId: number | undefined;
          let vendorFirstName: string | undefined;
          let vendorLastName: string | undefined;
          let vendorName = 'LLM';

          if (project.freelancerId) {
            const fl = await Collections.freelancers(db).findOne({
              freelancerId: project.freelancerId,
            });
            if (fl) {
              ratePerWord = fl.ratePerWord;
              freelancerId = fl.freelancerId;
              vendorName = fl.name;
              const [first, ...rest] = fl.name.split('-');
              vendorFirstName = first;
              vendorLastName = rest.join('-') || undefined;
            }
          }

          const allJobs = await Collections.jobs(db).find({ projectId }).toArray();
          const totalWords = allJobs.reduce((s, j) => s + j.wordCount, 0);
          const totalBillable = allJobs.reduce((s, j) => s + j.billableWords, 0);
          const amount = Math.round(totalBillable * ratePerWord * 100) / 100;
          const costId = await nextId(db, 'cost');

          await Collections.costs(db).insertOne({
            costId,
            projectId,
            freelancerId,
            vendorFirstName,
            vendorLastName,
            totalWords,
            billableWords: totalBillable,
            ratePerWord,
            amount,
            currency: 'USD',
            createdAt: now,
          });

          const poId = await nextId(db, 'po');
          await Collections.purchaseOrders(db).insertOne({
            poId,
            costId,
            projectId,
            freelancerId,
            vendorName,
            amount,
            currency: 'USD',
            processId: `PO-${projectId}-${costId}`,
            createdAt: now,
          });
          await Collections.projects(db).updateOne(
            { projectId },
            { $set: { poNumber: `PO-${projectId}-${costId}`, updatedAt: now } },
          );
        }
      }

      return reply.send({ success: true, jobId, billableWords });
    },
  );
};

async function fireCallback(
  db: import('mongodb').Db,
  broker: import('@mercury/core').MessageBroker,
  url: string | undefined,
  opts: {
    projectId: number;
    jobId?: number;
    customerId: number;
    event: CallbackLog['event'];
    build: () => import('@mercury/core').WebhookRequest;
    now: Date;
  },
): Promise<void> {
  if (!url) return;
  const req = opts.build();
  const callbackId = await nextId(db, 'callback');
  await Collections.callbackLogs(db).insertOne({
    callbackId,
    projectId: opts.projectId,
    jobId: opts.jobId,
    event: opts.event,
    url: req.url,
    method: req.method,
    headers: req.headers,
    body: req.body,
    payload: {},
    attempts: 0,
    success: false,
    createdAt: opts.now,
  });
  await broker.enqueueWebhook({
    callbackId,
    projectId: opts.projectId,
    jobId: opts.jobId,
    customerId: opts.customerId,
    event: opts.event,
    url: req.url,
    method: req.method,
    headers: req.headers,
    body: req.body,
  });
}

async function resetAndEnqueueJob(
  broker: import('@mercury/core').MessageBroker,
  db: import('mongodb').Db,
  opts: {
    projectId: number;
    jobId: number;
    sourceLanguage: string;
    targetLanguage: string;
    now: Date;
    fileName?: string;
    sourceFileKey?: string;
    sourceHash?: string;
    sourceContent?: Record<string, unknown>;
  },
): Promise<void> {
  const set: Record<string, unknown> = {
    status: 'CREATED',
    wordCount: 0,
    billableWords: 0,
    updatedAt: opts.now,
  };
  if (opts.fileName !== undefined) set['fileName'] = opts.fileName;
  if (opts.sourceFileKey !== undefined) set['sourceFileKey'] = opts.sourceFileKey;
  if (opts.sourceHash !== undefined) set['sourceHash'] = opts.sourceHash;
  if (opts.sourceContent !== undefined) set['sourceContent'] = opts.sourceContent;

  await Collections.segments(db).deleteMany({ jobId: opts.jobId });
  await Collections.jobs(db).updateOne(
    { projectId: opts.projectId, jobId: opts.jobId },
    {
      $set: set,
      $unset: { targetContent: '', segmentCache: '', completedAt: '' },
    },
  );
  await Collections.projects(db).updateOne(
    { projectId: opts.projectId },
    { $set: { status: 'CREATED', updatedAt: opts.now } },
  );
  await broker.enqueueTranslate({
    projectId: opts.projectId,
    jobId: opts.jobId,
    sourceLanguage: opts.sourceLanguage,
    targetLanguage: opts.targetLanguage,
  });
}

export default adminJobRoutes;
