import { FastifyPluginAsync } from 'fastify';
import JSZip from 'jszip';
import { Collections, nextId } from '@mercury/core';
import type { Job } from '@mercury/core';
import { createHash } from 'crypto';

const BASE = '/project-manager-api-rest/projects/:projectId';

const xtmFileRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /:projectId/files/status — legacy path kept for compatibility; analysis is always FINISHED
  fastify.get<{ Params: { projectId: string } }>(`${BASE}/files/status`, async (request, reply) => {
    const projectId = parseInt(request.params.projectId, 10);
    const jobs = await Collections.jobs(fastify.mongo).find({ projectId }).toArray();
    if (jobs.length === 0) return reply.status(404).send({ error: 'No jobs found for project' });

    return reply.send({
      projectId,
      status: 'FINISHED',
      jobs: (jobs as Job[]).map((j) => ({
        jobId: j.jobId,
        fileName: j.fileName,
        status: 'FINISHED',
      })),
    });
  });

  // POST /:projectId/files/sources/upload — upload additional / replacement source files
  // rosetta sends files as `files[N].file` parts; matchType = "MATCH_NAMES" form field
  fastify.post<{ Params: { projectId: string }; Querystring: { reanalyseProject?: string } }>(
    `${BASE}/files/sources/upload`,
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const db = fastify.mongo;

      const project = await Collections.projects(db).findOne({ projectId });
      if (!project) return reply.status(404).send({ error: 'Project not found' });

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

      const broker = fastify.broker;
      const now = new Date();
      const jobResults: Array<{ jobId: number; fileName: string; action: 'created' | 'replaced' }> = [];

      for (const f of files) {
        const sourceHash = createHash('sha256').update(f.buffer).digest('hex');
        let sourceContent: Record<string, unknown> = {};
        try {
          sourceContent = JSON.parse(f.buffer.toString('utf-8'));
        } catch {
          // non-JSON
        }

        const existing = await Collections.jobs(db).findOne({ projectId, fileName: f.filename });

        if (existing) {
          if (existing.sourceHash !== sourceHash) {
            // Snapshot existing translations before clearing so worker reuses unchanged sentences (Fix 5)
            const existingSegs = await Collections.segments(db)
              .find({ jobId: existing.jobId, state: { $in: ['TRANSLATED', 'APPROVED'] } })
              .toArray();
            const segmentCache: Record<string, string> = {};
            for (const s of existingSegs) {
              if (s.target) segmentCache[s.sourceHash] = s.target;
            }
            await Collections.segments(db).deleteMany({ jobId: existing.jobId });
            await Collections.jobs(db).updateOne(
              { jobId: existing.jobId },
              {
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
              },
            );
            await broker.enqueueTranslate({
              projectId,
              jobId: existing.jobId,
              sourceLanguage: project.sourceLanguage,
              targetLanguage: project.targetLanguage,
            });
          }
          jobResults.push({ jobId: existing.jobId, fileName: f.filename, action: 'replaced' });
        } else {
          const jobId = await nextId(db, 'job');
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
    },
  );

  // GET /:projectId/files/download?fileType=TARGET[&jobIds=123,456]
  // Each file in the zip preserves rosetta's {content, metadata} envelope byte-for-byte.
  fastify.get<{
    Params: { projectId: string };
    Querystring: { fileType?: string; jobIds?: string };
  }>(`${BASE}/files/download`, async (request, reply) => {
    const projectId = parseInt(request.params.projectId, 10);
    const db = fastify.mongo;

    const project = await Collections.projects(db).findOne({ projectId });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    let jobFilter: Record<string, unknown> = { projectId };
    if (request.query.jobIds) {
      const ids = request.query.jobIds
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      jobFilter = { projectId, jobId: { $in: ids } };
    }

    const jobs = (await Collections.jobs(db).find(jobFilter).toArray()) as Job[];
    const unfinished = jobs.filter((j) => j.status !== 'FINISHED');
    if (unfinished.length > 0) {
      return reply.status(409).send({
        error: 'Not all jobs are finished',
        pending: unfinished.map((j) => j.jobId),
      });
    }

    const zip = new JSZip();
    for (const job of jobs) {
      const source = (job.sourceContent ?? {}) as Record<string, unknown>;
      const isRosettaFile =
        source['content'] !== null &&
        typeof source['content'] === 'object' &&
        source['metadata'] !== undefined;

      let zipEntry: unknown;
      if (isRosettaFile) {
        // Preserve original metadata, swap content with translated version
        zipEntry = {
          content: (job.targetContent as Record<string, unknown>)?.['content']
            ?? job.targetContent
            ?? source['content'],
          metadata: source['metadata'],
        };
      } else {
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
  fastify.put<{ Params: { projectId: string } }>(`${BASE}/files`, async (request, reply) => {
    const projectId = parseInt(request.params.projectId, 10);
    const db = fastify.mongo;
    const project = await Collections.projects(db).findOne({ projectId });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const jobs = await Collections.jobs(db).find({ projectId }).toArray();
    const now = new Date();
    for (const job of jobs) {
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
    }
    await Collections.projects(db).updateOne({ projectId }, { $set: { status: 'CREATED', updatedAt: now } });
    return reply.send({ success: true });
  });
};

export default xtmFileRoutes;
