import { FastifyPluginAsync } from 'fastify';
import { Collections, QA } from '@mercury/core';
import type { Segment } from '@mercury/core';

const adminSegmentRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/api/projects/:projectId/segments?jobId=&fieldKey=&matchType=&state=&limit=&skip=
  fastify.get<{ Params: { projectId: string } }>(
    '/admin/api/projects/:projectId/segments',
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const q = request.query as {
        jobId?: string;
        fieldKey?: string;
        matchType?: string;
        state?: string;
        limit?: string;
        skip?: string;
      };

      const filter: Record<string, unknown> = { projectId };
      if (q.jobId) filter['jobId'] = parseInt(q.jobId, 10);
      if (q.fieldKey) filter['fieldKey'] = q.fieldKey;
      if (q.matchType) filter['matchType'] = q.matchType;
      if (q.state) filter['state'] = q.state;

      const limit = Math.min(parseInt(q.limit ?? '50', 10), 200);
      const skip = parseInt(q.skip ?? '0', 10);
      const db = fastify.mongo;

      const [data, total] = await Promise.all([
        Collections.segments(db)
          .find(filter)
          .sort({ fieldKey: 1, index: 1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        Collections.segments(db).countDocuments(filter),
      ]);

      return reply.send({ data, total, limit, skip });
    },
  );

  // PUT /admin/api/projects/:projectId/segments/:segmentId — edit target (human translation)
  fastify.put<{ Params: { projectId: string; segmentId: string } }>(
    '/admin/api/projects/:projectId/segments/:segmentId',
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const segmentId = parseInt(request.params.segmentId, 10);
      const { target } = request.body as { target: string };
      const db = fastify.mongo;

      const result = await Collections.segments(db).findOneAndUpdate(
        { segmentId, projectId },
        { $set: { target, state: 'TRANSLATED', updatedAt: new Date() } },
        { returnDocument: 'after' },
      );

      if (!result) return reply.status(404).send({ error: 'Segment not found' });
      return reply.send({ success: true, segmentId });
    },
  );

  // POST /admin/api/projects/:projectId/segments/:segmentId/approve
  fastify.post<{ Params: { projectId: string; segmentId: string } }>(
    '/admin/api/projects/:projectId/segments/:segmentId/approve',
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const segmentId = parseInt(request.params.segmentId, 10);
      const db = fastify.mongo;

      const segment = (await Collections.segments(db).findOne({
        segmentId,
        projectId,
      })) as Segment | null;
      if (!segment) return reply.status(404).send({ error: 'Segment not found' });
      if (!segment.target) return reply.status(422).send({ errors: [{ code: 'NO_TARGET', message: 'Segment has no target translation' }] });
      if (segment.state === 'APPROVED') return reply.send({ success: true, segmentId, alreadyApproved: true });

      const qaResult = QA.runQA(segment.source, segment.target);
      if (!qaResult.passed) {
        return reply.status(422).send({ errors: qaResult.errors });
      }

      await Collections.segments(db).updateOne(
        { segmentId, projectId },
        { $set: { state: 'APPROVED', approved: true, locked: true, updatedAt: new Date() } },
      );

      return reply.send({ success: true, segmentId });
    },
  );
};

export default adminSegmentRoutes;
