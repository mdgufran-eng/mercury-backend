import { FastifyPluginAsync } from 'fastify';
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
declare const trainingDataRoutes: FastifyPluginAsync;
export default trainingDataRoutes;
