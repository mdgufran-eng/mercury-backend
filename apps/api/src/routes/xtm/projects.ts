import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { createHash } from 'crypto';
import {
  Collections,
  nextId,
  buildProjectCreatedWebhook,
  buildAnalysisFinishedWebhook,
  buildActivityChangedWebhook,
} from '@mercury/core';
import type { Project, Job, CallbackLog, MessageBroker } from '@mercury/core';

const BASE = '/project-manager-api-rest/projects';

function pick(fields: Record<string, string>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    if (fields[k] !== undefined) return fields[k];
  }
  return undefined;
}

async function collectParts(request: FastifyRequest) {
  const fields: Record<string, string> = {};
  const files: Array<{ fieldname: string; filename: string; buffer: Buffer }> = [];

  for await (const part of request.parts()) {
    if (part.type === 'field') {
      fields[part.fieldname] = part.value as string;
    } else {
      const buffer = await part.toBuffer();
      files.push({ fieldname: part.fieldname, filename: part.filename, buffer });
    }
  }

  return { fields, files };
}

const xtmProjectRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /project-manager-api-rest/projects — create project (multipart/form-data)
  fastify.post(BASE, async (request, reply) => {
    const { fields, files } = await collectParts(request);

    const customerId = parseInt(pick(fields, 'customerId') ?? '0', 10);
    const name = pick(fields, 'name') ?? '';
    const templateId = parseInt(pick(fields, 'templateId') ?? '0', 10);
    const referenceId = pick(fields, 'referenceId');
    const description = pick(fields, 'description');
    const throwOnDuplicate =
      pick(fields, 'errorAction.duplicateName') === 'THROW_EXCEPTION';

    // Exact field names rosetta sends (verified from XTMClient.kt)
    const callbackUrls: Project['callbackUrls'] = {
      projectCreated:       pick(fields, 'callbacks.projectCreatedCallback'),
      analysisFinished:     pick(fields, 'callbacks.analysisFinishedCallback'),
      jobFinished:          pick(fields, 'callbacks.jobFinishedCallback'),
      projectCompletion:    pick(fields, 'callbacks.projectFinishedCallback'),
      sourceFileUpdated:    pick(fields, 'callbacks.sourceFileUpdatedCallbacks[0]'),
      projectActivityChanged: pick(fields, 'callbacks.projectActivityChangedCallbacks[0]'),
    };

    const db = fastify.mongo;

    const template = await Collections.templates(db).findOne({ templateId });
    if (!template) {
      return reply.status(400).send({ error: `Template ${templateId} not found` });
    }

    if (throwOnDuplicate) {
      const existing = await Collections.projects(db).findOne({ name });
      if (existing) {
        return reply.status(409).send({ error: `Project with name "${name}" already exists` });
      }
    }

    const projectId = await nextId(db, 'project');
    const now = new Date();

    const project: Project = {
      projectId,
      name,
      customerId,
      templateId,
      sourceLanguage: template.sourceLanguage,
      targetLanguage: template.targetLanguage,
      method: template.method,
      status: 'CREATED',
      activity: 'ACTIVE',
      referenceId,
      description,
      callbackUrls,
      createdAt: now,
      updatedAt: now,
    };

    await Collections.projects(db).insertOne(project);

    // For HUMAN projects: auto-assign an LLM freelancer matching the target language.
    if (template.method === 'HUMAN') {
      const fl = await Collections.freelancers(db).findOne({
        languages: template.targetLanguage.toLowerCase(),
      });
      if (fl) {
        await Collections.projects(db).updateOne(
          { projectId },
          { $set: { freelancerId: fl.freelancerId } },
        );
      }
    }

    const jobResults: Array<{
      jobId: number;
      fileName: string;
      sourceLanguage: string;
      targetLanguage: string;
    }> = [];

    for (const f of files) {
      const jobId = await nextId(db, 'job');

      let sourceContent: Record<string, unknown> = {};
      try {
        sourceContent = JSON.parse(f.buffer.toString('utf-8'));
      } catch {
        // non-JSON source
      }
      const sourceHash = createHash('sha256').update(f.buffer).digest('hex');

      const job: Job = {
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
      jobResults.push({
        jobId,
        fileName: f.filename,
        sourceLanguage: template.sourceLanguage,
        targetLanguage: template.targetLanguage,
      });
    }

    const broker = fastify.broker;

    await fireCallback(db, broker, {
      projectId,
      customerId,
      event: 'project-created',
      url: callbackUrls.projectCreated,
      build: () => buildProjectCreatedWebhook(callbackUrls.projectCreated!, projectId),
    });
    await fireCallback(db, broker, {
      projectId,
      customerId,
      event: 'analysis-finished',
      url: callbackUrls.analysisFinished,
      build: () => buildAnalysisFinishedWebhook(callbackUrls.analysisFinished!, projectId),
    });

    // Enqueue ALL projects — worker segments HUMAN jobs, translates MACHINE jobs.
    for (const { jobId } of jobResults) {
      await broker.enqueueTranslate({
        projectId,
        jobId,
        sourceLanguage: template.sourceLanguage,
        targetLanguage: template.targetLanguage,
      });
    }

    // Response uses jobID (capital D) to match rosetta's ProjectCreationJob model
    return reply.status(201).send({
      projectId,
      name,
      jobs: jobResults.map((j) => ({
        jobID: j.jobId,
        fileName: j.fileName,
        sourceLanguage: j.sourceLanguage,
        targetLanguage: j.targetLanguage,
      })),
    });
  });

  // POST /projects/search — exact-name search
  fastify.post(`${BASE}/search`, async (request, reply) => {
    const body = request.body as { name?: string } | undefined;
    const name = body?.name;
    if (!name) return reply.send([]);

    const proj = await Collections.projects(fastify.mongo).findOne({ name });
    if (!proj) return reply.send([]);

    return reply.send([formatProject(proj)]);
  });

  // GET /projects — supports ids, name, and cleanup filters (createdDateTo, customerIds, activity, page, pageSize)
  fastify.get(BASE, async (request, reply) => {
    const query = request.query as {
      ids?: string;
      name?: string;
      createdDateTo?: string;
      customerIds?: string | string[];
      activity?: string | string[];
      page?: string;
      pageSize?: string;
    };
    const db = fastify.mongo;

    // Rosetta's bulk cleanup cron: GET /projects?createdDateTo=&customerIds=&activity=&page=&pageSize=
    if (query.createdDateTo || query.customerIds) {
      const filter: Record<string, unknown> = {};
      if (query.createdDateTo) filter['createdAt'] = { $lte: new Date(query.createdDateTo) };
      if (query.customerIds) {
        const ids = Array.isArray(query.customerIds)
          ? query.customerIds.map(Number)
          : query.customerIds.split(',').map(Number);
        filter['customerId'] = { $in: ids };
      }
      if (query.activity) {
        const acts = Array.isArray(query.activity)
          ? query.activity
          : query.activity.split(',');
        filter['activity'] = { $in: acts };
      }
      const pageSize = Math.min(parseInt(query.pageSize ?? '1000', 10), 1000);
      const page = Math.max(parseInt(query.page ?? '1', 10), 1);
      const projects = await Collections.projects(db)
        .find(filter)
        .sort({ createdAt: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray();
      return reply.send(projects.map(formatProject));
    }

    if (query.ids) {
      const ids = query.ids
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      const projects = await Collections.projects(db).find({ projectId: { $in: ids } }).toArray();
      return reply.send(projects.map(formatProject));
    }

    if (query.name) {
      const proj = await Collections.projects(db).findOne({ name: query.name });
      if (!proj) return reply.send([]);
      return reply.send([formatProject(proj)]);
    }

    return reply.send([]);
  });

  // GET /projects/:projectId/analysis — analysis status (always FINISHED in v1)
  fastify.get<{ Params: { projectId: string } }>(
    `${BASE}/:projectId/analysis`,
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const proj = await Collections.projects(fastify.mongo).findOne({ projectId });
      if (!proj) return reply.status(404).send({ error: 'Project not found' });
      return reply.send({ projectId, status: 'FINISHED' });
    },
  );

  // GET /projects/:projectId/status — activity + completionStatus
  fastify.get<{ Params: { projectId: string } }>(
    `${BASE}/:projectId/status`,
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const proj = await Collections.projects(fastify.mongo).findOne({ projectId });
      if (!proj) return reply.status(404).send({ error: 'Project not found' });
      return reply.send({
        projectId,
        activity: proj.activity,
        completionStatus: proj.status === 'FINISHED' ? 'FINISHED' : 'IN_PROGRESS',
      });
    },
  );

  // GET /projects/:projectId — full project detail
  fastify.get<{ Params: { projectId: string } }>(`${BASE}/:projectId`, async (request, reply) => {
    const projectId = parseInt(request.params.projectId, 10);
    const db = fastify.mongo;

    const proj = await Collections.projects(db).findOne({ projectId });
    if (!proj) return reply.status(404).send({ error: 'Project not found' });

    const jobs = await Collections.jobs(db).find({ projectId }).toArray();

    return reply.send({
      projectId: proj.projectId,
      name: proj.name,
      status: proj.status,
      activity: proj.activity,
      customerId: proj.customerId,
      sourceLanguage: proj.sourceLanguage,
      targetLanguage: proj.targetLanguage,
      method: proj.method,
      referenceId: proj.referenceId,
      description: proj.description,
      jobs: jobs.map((j: Job) => ({
        jobId: j.jobId,
        fileName: j.fileName,
        status: j.status,
        wordCount: j.wordCount,
        billableWords: j.billableWords,
      })),
    });
  });

  // POST /projects/:projectId/activate
  fastify.post<{ Params: { projectId: string } }>(
    `${BASE}/:projectId/activate`,
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const db = fastify.mongo;
      const result = await Collections.projects(db).updateOne(
        { projectId },
        { $set: { activity: 'ACTIVE', updatedAt: new Date() } },
      );
      if (result.matchedCount === 0) return reply.status(404).send({ error: 'Project not found' });
      const proj = await Collections.projects(db).findOne({ projectId });
      if (proj?.callbackUrls?.projectActivityChanged) {
        await fireCallback(db, fastify.broker, {
          projectId,
          customerId: proj.customerId,
          event: 'project-activity-changed',
          url: proj.callbackUrls.projectActivityChanged,
          build: () => buildActivityChangedWebhook(proj.callbackUrls.projectActivityChanged!, projectId, 'ACTIVE'),
        });
      }
      return reply.send({ success: true });
    },
  );

  // DELETE /projects/:projectId — soft delete
  fastify.delete<{ Params: { projectId: string } }>(`${BASE}/:projectId`, async (request, reply) => {
    const projectId = parseInt(request.params.projectId, 10);
    const db = fastify.mongo;
    const proj = await Collections.projects(db).findOne({ projectId });
    if (!proj) return reply.status(404).send({ error: 'Project not found' });
    await Collections.projects(db).updateOne(
      { projectId },
      { $set: { activity: 'DELETED', status: 'FAILED', updatedAt: new Date() } },
    );
    if (proj.callbackUrls?.projectActivityChanged) {
      await fireCallback(db, fastify.broker, {
        projectId,
        customerId: proj.customerId,
        event: 'project-activity-changed',
        url: proj.callbackUrls.projectActivityChanged,
        build: () => buildActivityChangedWebhook(proj.callbackUrls.projectActivityChanged!, projectId, 'DELETED'),
      });
    }
    return reply.send({ success: true });
  });

  // GET /projects/:projectId/users — {linguists, projectManager, projectCreator}
  fastify.get<{ Params: { projectId: string } }>(
    `${BASE}/:projectId/users`,
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const db = fastify.mongo;

      const proj = await Collections.projects(db).findOne({ projectId });
      if (!proj) return reply.status(404).send({ error: 'Project not found' });

      const system = { userId: 1, email: 'system@mercury.internal' };
      const linguists: Array<{ userId: number; email: string }> = [];

      if (proj.freelancerId) {
        const fl = await Collections.freelancers(db).findOne({ freelancerId: proj.freelancerId });
        if (fl) linguists.push({ userId: fl.freelancerId, email: fl.email });
      }

      return reply.send({ linguists, projectManager: system, projectCreator: system });
    },
  );

  // POST /projects/:projectId/reanalyze — re-translate all jobs using current model
  // Snapshots existing translations as a segment cache so unchanged sentences are free.
  fastify.post<{ Params: { projectId: string } }>(
    `${BASE}/:projectId/reanalyze`,
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const db = fastify.mongo;

      const project = await Collections.projects(db).findOne({ projectId });
      if (!project) return reply.status(404).send({ error: 'Project not found' });
      if (project.activity === 'DELETED') return reply.send({ success: false });

      const jobs = await Collections.jobs(db).find({ projectId }).toArray();
      const now = new Date();
      const jobsInReanalysis: Array<{ id: number }> = [];

      for (const job of jobs) {
        // Snapshot existing translations before clearing so worker skips unchanged sentences
        const existingSegs = await Collections.segments(db)
          .find({ jobId: job.jobId, state: { $in: ['TRANSLATED', 'APPROVED'] } })
          .toArray();
        const segmentCache: Record<string, string> = {};
        for (const s of existingSegs) {
          if (s.target) segmentCache[s.sourceHash] = s.target;
        }

        await Collections.segments(db).deleteMany({ jobId: job.jobId });
        await Collections.jobs(db).updateOne(
          { jobId: job.jobId },
          { $set: { status: 'CREATED', targetContent: undefined, billableWords: 0, segmentCache, updatedAt: now } },
        );
        await fastify.broker.enqueueTranslate({
          projectId,
          jobId: job.jobId,
          sourceLanguage: project.sourceLanguage,
          targetLanguage: project.targetLanguage,
        });
        jobsInReanalysis.push({ id: job.jobId });
      }

      await Collections.projects(db).updateOne(
        { projectId },
        { $set: { status: 'CREATED', updatedAt: now } },
      );

      return reply.send({ success: true, jobsInReanalysis });
    },
  );
};

// List/search endpoints return {id} (rosetta ProjectBulkResponse / SearchResult shape)
function formatProject(p: Project) {
  return {
    id: p.projectId,
    name: p.name,
    status: p.status,
    activity: p.activity,
  };
}

async function fireCallback(
  db: import('mongodb').Db,
  broker: MessageBroker,
  opts: {
    projectId: number;
    customerId: number;
    event: CallbackLog['event'];
    url: string | undefined;
    build: () => import('@mercury/core').WebhookRequest;
  },
): Promise<void> {
  if (!opts.url) return;

  const now = new Date();
  const callbackId = await nextId(db, 'callback');
  const req = opts.build();

  await Collections.callbackLogs(db).insertOne({
    callbackId,
    projectId: opts.projectId,
    event: opts.event,
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
    projectId: opts.projectId,
    customerId: opts.customerId,
    event: opts.event,
    url: req.url,
    method: req.method,
    headers: req.headers,
    body: req.body,
  });
}

export default xtmProjectRoutes;
