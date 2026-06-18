import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

import mongoPlugin from './plugins/mongo.js';
import redisPlugin from './plugins/redis.js';

import healthRoutes from './routes/health.js';
import xtmProjectRoutes from './routes/xtm/projects.js';
import xtmFileRoutes from './routes/xtm/files.js';
import xtmCostRoutes from './routes/xtm/costs.js';
import adminProjectRoutes from './routes/admin/projects.js';
import adminJobRoutes from './routes/admin/jobs.js';
import adminSegmentRoutes from './routes/admin/segments.js';
import adminCallbackRoutes from './routes/admin/callbacks.js';
import adminCustomerRoutes from './routes/admin/customers.js';
import adminTemplateRoutes from './routes/admin/templates.js';
import adminFreelancerRoutes from './routes/admin/freelancers.js';
import adminTmRoutes from './routes/admin/tm.js';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: true });

  // Infrastructure plugins
  await fastify.register(cors, { origin: true });
  await fastify.register(mongoPlugin);
  await fastify.register(redisPlugin);

  // Routes
  await fastify.register(healthRoutes);

  // XTM-compatible routes
  await fastify.register(xtmProjectRoutes);
  await fastify.register(xtmFileRoutes);
  await fastify.register(xtmCostRoutes);

  // Admin routes
  await fastify.register(adminProjectRoutes);
  await fastify.register(adminJobRoutes);
  await fastify.register(adminSegmentRoutes);
  await fastify.register(adminCallbackRoutes);
  await fastify.register(adminCustomerRoutes);
  await fastify.register(adminTemplateRoutes);
  await fastify.register(adminFreelancerRoutes);
  await fastify.register(adminTmRoutes);

  return fastify;
}
