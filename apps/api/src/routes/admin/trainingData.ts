import { FastifyPluginAsync } from 'fastify';
import { Collections } from '@mercury/core';

/**
 * Training data export for ML model fine-tuning.
 *
 * The ML team polls this endpoint to get new approved segment pairs
 * and adds them to the fine-tuning dataset.
 *
 * Typical cron (nightly):
 *   curl "https://mercury/admin/api/training-data?since=2026-06-18T00:00:00Z&format=jsonl" \
 *     >> training/approved_$(date +%Y%m%d).jsonl
 */
const trainingDataRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /admin/api/training-data
   *
   * Query params:
   *   since       ISO timestamp — only pairs approved after this date (default: 30 days ago)
   *   until       ISO timestamp — upper bound (default: now)
   *   sourceLang  e.g. EN  (default: all)
   *   targetLang  e.g. DE  (default: all)
   *   format      "jsonl" (default) | "json"
   *   limit       max records (default: 10000, max: 50000)
   *
   * JSONL format (one record per line — directly loadable by HuggingFace datasets):
   *   {"id":"seg-123","sourceText":"Hello world","targetText":"Hallo Welt","sourceLang":"EN","targetLang":"DE","approvedAt":"2026-06-18T..."}
   *
   * JSON format (array — for inspection):
   *   [{"id":...}, ...]
   */
  fastify.get('/admin/api/training-data', async (request, reply) => {
    const q = request.query as {
      since?: string;
      until?: string;
      sourceLang?: string;
      targetLang?: string;
      format?: string;
      limit?: string;
    };

    const since = q.since ? new Date(q.since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const until = q.until ? new Date(q.until) : new Date();
    if (isNaN(since.getTime())) return reply.status(400).send({ error: `Invalid 'since' date: ${q.since}` });
    if (isNaN(until.getTime())) return reply.status(400).send({ error: `Invalid 'until' date: ${q.until}` });
    const limit = Math.min(parseInt(q.limit ?? '10000', 10), 50_000);
    const format = q.format === 'json' ? 'json' : 'jsonl';

    const db = fastify.mongo;

    // Find all approved segments in the time window
    const segmentFilter: Record<string, unknown> = {
      state: 'APPROVED',
      approved: true,
      updatedAt: { $gte: since, $lte: until },
    };

    const segments = await Collections.segments(db)
      .find(segmentFilter)
      .sort({ updatedAt: 1 })
      .limit(limit)
      .toArray();

    if (segments.length === 0) {
      if (format === 'json') return reply.send([]);
      reply.header('Content-Type', 'text/plain');
      return reply.send('');
    }

    // Enrich with language pair from project
    const projectIds = [...new Set(segments.map((s) => s.projectId))];
    const projects = await Collections.projects(db)
      .find({ projectId: { $in: projectIds } })
      .toArray();
    const projectMap = new Map(projects.map((p) => [p.projectId, p]));

    const records = segments
      .filter((s) => s.target && s.target.trim().length > 0)
      .map((s) => {
        const project = projectMap.get(s.projectId);

        // Apply language filters
        if (q.sourceLang && project?.sourceLanguage?.toUpperCase() !== q.sourceLang.toUpperCase()) return null;
        if (q.targetLang && project?.targetLanguage?.toLowerCase() !== q.targetLang.toLowerCase()) return null;

        return {
          id: String(s.segmentId),
          sourceText: s.source,
          targetText: s.target!,
          sourceLang: project?.sourceLanguage ?? 'EN',
          targetLang: project?.targetLanguage ?? 'unknown',
          projectId: s.projectId,
          approvedAt: s.updatedAt.toISOString(),
        };
      })
      .filter(Boolean);

    if (format === 'json') {
      return reply.send(records);
    }

    // JSONL — one record per line, directly streamable
    reply.header('Content-Type', 'application/x-ndjson');
    reply.header('Content-Disposition', `attachment; filename="training-${Date.now()}.jsonl"`);
    return reply.send(records.map((r) => JSON.stringify(r)).join('\n'));
  });

  /**
   * GET /admin/api/training-data/stats
   * Quick summary: how many approved pairs per language pair.
   */
  fastify.get('/admin/api/training-data/stats', async (_request, reply) => {
    const db = fastify.mongo;

    const agg = await Collections.segments(db)
      .aggregate<{ _id: { projectId: number }; count: number }>([
        { $match: { state: 'APPROVED', approved: true } },
        { $group: { _id: { projectId: '$projectId' }, count: { $sum: 1 } } },
      ])
      .toArray();

    const projectIds = agg.map((a) => a._id.projectId);
    const projects = await Collections.projects(db)
      .find({ projectId: { $in: projectIds } })
      .toArray();
    const projectMap = new Map(projects.map((p) => [p.projectId, p]));

    const byPair: Record<string, number> = {};
    for (const { _id, count } of agg) {
      const p = projectMap.get(_id.projectId);
      const key = p ? `${p.sourceLanguage}→${p.targetLanguage}` : 'unknown';
      byPair[key] = (byPair[key] ?? 0) + count;
    }

    const total = Object.values(byPair).reduce((s, n) => s + n, 0);
    return reply.send({ total, byLanguagePair: byPair });
  });
};

export default trainingDataRoutes;
