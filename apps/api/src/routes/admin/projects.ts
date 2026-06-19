import { FastifyPluginAsync } from 'fastify';
import { Collections, nextId, buildProjectCreatedWebhook, buildAnalysisFinishedWebhook } from '@mercury/core';
import type { CallbackLog, MessageBroker } from '@mercury/core';

const adminProjectRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/api/projects?status=&method=&customerId=&limit=50&skip=0
  fastify.get('/admin/api/projects', async (request, reply) => {
    const q = request.query as {
      status?: string;
      method?: string;
      customerId?: string;
      limit?: string;
      skip?: string;
    };

    const filter: Record<string, unknown> = {};
    if (q.status) filter['status'] = q.status;
    if (q.method) filter['method'] = q.method;
    if (q.customerId) filter['customerId'] = parseInt(q.customerId, 10);

    const limit = Math.min(parseInt(q.limit ?? '50', 10), 200);
    const skip = parseInt(q.skip ?? '0', 10);
    const db = fastify.mongo;

    const [projects, total] = await Promise.all([
      Collections.projects(db).find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      Collections.projects(db).countDocuments(filter),
    ]);

    // Enrich with customer names and job counts in one pass
    const customerIds = [...new Set(projects.map((p) => p.customerId))];
    const [customers, jobCounts] = await Promise.all([
      Collections.customers(db).find({ customerId: { $in: customerIds } }).toArray(),
      Promise.all(
        projects.map((p) =>
          Collections.jobs(db).countDocuments({ projectId: p.projectId }).then((c) => ({
            projectId: p.projectId,
            count: c,
          })),
        ),
      ),
    ]);

    const customerMap = new Map(customers.map((c) => [c.customerId, c.name]));
    const jobCountMap = new Map(jobCounts.map((j) => [j.projectId, j.count]));

    return reply.send({
      data: projects.map((p) => ({
        id: String(p.projectId),
        projectId: p.projectId,
        name: p.name,
        customerId: String(p.customerId),
        customerName: customerMap.get(p.customerId) ?? String(p.customerId),
        sourceLang: p.sourceLanguage,
        targetLang: p.targetLanguage,
        sourceLanguage: p.sourceLanguage,
        targetLanguage: p.targetLanguage,
        status: p.status,
        activity: p.activity,
        method: p.method,
        templateId: String(p.templateId),
        jobCount: jobCountMap.get(p.projectId) ?? 0,
        referenceId: p.referenceId,
        description: p.description,
        poNumber: p.poNumber ?? '',
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      total,
      limit,
      skip,
    });
  });

  // GET /admin/api/projects/:projectId
  fastify.get<{ Params: { projectId: string } }>(
    '/admin/api/projects/:projectId',
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const db = fastify.mongo;

      const [proj, jobs] = await Promise.all([
        Collections.projects(db).findOne({ projectId }),
        Collections.jobs(db).find({ projectId }).sort({ createdAt: 1 }).toArray(),
      ]);

      if (!proj) return reply.status(404).send({ error: 'Project not found' });

      const customer = await Collections.customers(db).findOne({ customerId: proj.customerId });

      return reply.send({
        id: String(proj.projectId),
        projectId: proj.projectId,
        name: proj.name,
        customerId: String(proj.customerId),
        customerName: customer?.name ?? String(proj.customerId),
        sourceLang: proj.sourceLanguage,
        targetLang: proj.targetLanguage,
        sourceLanguage: proj.sourceLanguage,
        targetLanguage: proj.targetLanguage,
        status: proj.status,
        activity: proj.activity,
        method: proj.method,
        templateId: String(proj.templateId),
        referenceId: proj.referenceId,
        description: proj.description,
        poNumber: proj.poNumber ?? '',
        freelancerId: proj.freelancerId,
        callbackUrls: proj.callbackUrls,
        createdAt: proj.createdAt.toISOString(),
        updatedAt: proj.updatedAt.toISOString(),
        jobs: jobs.map((j) => ({
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
          createdAt: j.createdAt.toISOString(),
          updatedAt: j.updatedAt.toISOString(),
        })),
      });
    },
  );

  // GET /admin/api/stats — dashboard aggregation
  fastify.get('/admin/api/stats', async (_request, reply) => {
    const db = fastify.mongo;

    const [
      totalProjects,
      statusCounts,
      recentProjects,
      recentCallbacks,
      segmentCounts,
      wordAgg,
    ] = await Promise.all([
      Collections.projects(db).countDocuments(),
      Collections.projects(db)
        .aggregate<{ _id: string; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }])
        .toArray(),
      Collections.projects(db).find().sort({ createdAt: -1 }).limit(5).toArray(),
      Collections.callbackLogs(db).find().sort({ createdAt: -1 }).limit(6).toArray(),
      Collections.segments(db)
        .aggregate<{ _id: string; count: number }>([{ $group: { _id: '$matchType', count: { $sum: 1 } } }])
        .toArray(),
      Collections.jobs(db)
        .aggregate<{ totalWords: number; billableWords: number }>([
          { $group: { _id: null, totalWords: { $sum: '$wordCount' }, billableWords: { $sum: '$billableWords' } } },
        ])
        .toArray(),
    ]);

    const byStatus: Record<string, number> = {};
    for (const s of statusCounts) byStatus[s._id] = s.count;

    const segMap: Record<string, number> = {};
    for (const s of segmentCounts) if (s._id) segMap[s._id] = s.count;

    const iceSegments = segMap['ICE'] ?? 0;
    const mtSegments = segMap['MT'] ?? 0;
    const totalSegments = iceSegments + mtSegments;
    const words = wordAgg[0] ?? { totalWords: 0, billableWords: 0 };

    const customerIds = [...new Set(recentProjects.map((p) => p.customerId))];
    const customers = await Collections.customers(db)
      .find({ customerId: { $in: customerIds } })
      .toArray();
    const cMap = new Map(customers.map((c) => [c.customerId, c.name]));

    return reply.send({
      totalProjects,
      activeProjects: (byStatus['ACTIVE'] ?? 0) + (byStatus['IN_PROGRESS'] ?? 0),
      finishedProjects: byStatus['FINISHED'] ?? 0,
      failedProjects: byStatus['FAILED'] ?? 0,
      totalWords: words.totalWords,
      billableWords: words.billableWords,
      tmLeveragePct: totalSegments ? Math.round((iceSegments / totalSegments) * 100) : 0,
      totalSegments,
      iceSegments,
      mtSegments,
      byStatus,
      recentProjects: recentProjects.map((p) => ({
        id: String(p.projectId),
        projectId: p.projectId,
        name: p.name,
        status: p.status,
        method: p.method,
        customerName: cMap.get(p.customerId) ?? String(p.customerId),
        sourceLang: p.sourceLanguage,
        targetLang: p.targetLanguage,
        poNumber: p.poNumber ?? '',
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      recentCallbacks: recentCallbacks.map((c) => ({
        id: String(c.callbackId),
        event: c.event,
        projectId: String(c.projectId),
        url: c.url,
        success: c.success,
        statusCode: c.responseStatus ?? 0,
        attempts: c.attempts,
        sentAt: c.lastAttemptAt?.toISOString() ?? c.createdAt.toISOString(),
      })),
    });
  });
  // POST /admin/api/projects — create a project from the frontend "Upload Project" modal
  fastify.post('/admin/api/projects', async (request, reply) => {
    const body = request.body as {
      name: string;
      customerId: string | number;
      sourceLang?: string;
      targetLang: string;
      method: 'MACHINE' | 'HUMAN';
      callbackUrls?: {
        projectCreated?: string;
        analysisFinished?: string;
        jobFinished?: string;
        projectCompletion?: string;
        sourceFileUpdated?: string;
        projectActivityChanged?: string;
      };
    };

    const db = fastify.mongo;
    const customerId = parseInt(String(body.customerId), 10);
    const sourceLanguage = (body.sourceLang ?? 'EN').toUpperCase();
    const targetLanguage = body.targetLang.toUpperCase();

    // Find a matching template (method + targetLanguage), fallback to 0
    const template = await Collections.templates(db).findOne({
      method: body.method,
      targetLanguage: targetLanguage.toLowerCase(),
    });

    // For HUMAN projects, auto-assign a freelancer by targetLanguage
    let freelancerId: number | undefined;
    if (body.method === 'HUMAN') {
      const fl = await Collections.freelancers(db).findOne({
        languages: targetLanguage.toLowerCase(),
      });
      freelancerId = fl?.freelancerId;
    }

    const projectId = await nextId(db, 'project');
    const now = new Date();

    const callbackUrls: import('@mercury/core').Project['callbackUrls'] = {
      projectCreated:         body.callbackUrls?.projectCreated         || undefined,
      analysisFinished:       body.callbackUrls?.analysisFinished       || undefined,
      jobFinished:            body.callbackUrls?.jobFinished            || undefined,
      projectCompletion:      body.callbackUrls?.projectCompletion      || undefined,
      sourceFileUpdated:      body.callbackUrls?.sourceFileUpdated      || undefined,
      projectActivityChanged: body.callbackUrls?.projectActivityChanged || undefined,
    };

    const project: import('@mercury/core').Project = {
      projectId,
      name: body.name,
      customerId,
      templateId: template?.templateId ?? 0,
      sourceLanguage,
      targetLanguage,
      method: body.method,
      status: 'CREATED',
      activity: 'ACTIVE',
      freelancerId,
      callbackUrls,
      createdAt: now,
      updatedAt: now,
    };

    await Collections.projects(db).insertOne(project);

    const broker = fastify.broker;
    await fireAdminCallback(db, broker, {
      projectId,
      customerId,
      event: 'project-created',
      url: callbackUrls.projectCreated,
      build: () => buildProjectCreatedWebhook(callbackUrls.projectCreated!, projectId),
      payload: { xtmProjectId: projectId },
    });
    await fireAdminCallback(db, broker, {
      projectId,
      customerId,
      event: 'analysis-finished',
      url: callbackUrls.analysisFinished,
      build: () => buildAnalysisFinishedWebhook(callbackUrls.analysisFinished!, projectId),
      payload: { xtmProjectId: projectId },
    });

    return reply.status(201).send({
      id: String(projectId),
      projectId,
      name: project.name,
      customerId: String(customerId),
      sourceLang: sourceLanguage,
      targetLang: targetLanguage,
      status: project.status,
      activity: project.activity,
      method: project.method,
      jobCount: 0,
      poNumber: '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  });
};

async function fireAdminCallback(
  db: import('mongodb').Db,
  broker: MessageBroker,
  opts: {
    projectId: number;
    customerId: number;
    event: CallbackLog['event'];
    url: string | undefined;
    build: () => import('@mercury/core').WebhookRequest;
    payload?: Record<string, unknown>;
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
    payload: opts.payload ?? {},
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

export default adminProjectRoutes;
