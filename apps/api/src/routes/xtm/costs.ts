import { FastifyPluginAsync } from 'fastify';
import { Collections, nextId } from '@mercury/core';
import type { Cost, PurchaseOrder } from '@mercury/core';

const BASE = '/project-manager-api-rest/projects/:projectId';

const xtmCostRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /:projectId/costs — generate cost record; returns {costId} only
  fastify.post<{ Params: { projectId: string } }>(`${BASE}/costs`, async (request, reply) => {
    const projectId = parseInt(request.params.projectId, 10);
    const db = fastify.mongo;

    const project = await Collections.projects(db).findOne({ projectId });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const jobs = await Collections.jobs(db).find({ projectId, status: 'FINISHED' }).toArray();
    const billableWords = jobs.reduce((sum, j) => sum + (j.billableWords ?? 0), 0);
    const totalWords = jobs.reduce((sum, j) => sum + (j.wordCount ?? 0), 0);

    let ratePerWord = 0.05;
    let freelancerId: number | undefined;
    let vendorFirstName: string | undefined;
    let vendorLastName: string | undefined;

    if (project.freelancerId) {
      const fl = await Collections.freelancers(db).findOne({ freelancerId: project.freelancerId });
      if (fl) {
        ratePerWord = fl.ratePerWord;
        freelancerId = fl.freelancerId;
        const [first, ...rest] = fl.name.split('-');
        vendorFirstName = first;
        vendorLastName = rest.join('-') || undefined;
      }
    }

    const amount = Math.round(billableWords * ratePerWord * 100) / 100;
    const costId = await nextId(db, 'cost');

    const cost: Cost = {
      costId,
      projectId,
      freelancerId,
      vendorFirstName,
      vendorLastName,
      totalWords,
      billableWords,
      ratePerWord,
      amount,
      currency: 'USD',
      createdAt: new Date(),
    };

    await Collections.costs(db).insertOne(cost);

    // Rosetta reads only costId from CostGenerationResponse
    return reply.status(201).send({ costId });
  });

  // POST /:projectId/costs/:costId/pos — generate PO; returns {processId} only
  fastify.post<{
    Params: { projectId: string; costId: string };
    Querystring: { userId?: string; costsBreakdown?: string; calculationMethod?: string; includeRates?: string };
  }>(
    `${BASE}/costs/:costId/pos`,
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const costId = parseInt(request.params.costId, 10);
      const db = fastify.mongo;

      const cost = await Collections.costs(db).findOne({ costId, projectId });
      if (!cost) return reply.status(404).send({ error: 'Cost not found' });

      const project = await Collections.projects(db).findOne({ projectId });
      if (!project) return reply.status(404).send({ error: 'Project not found' });

      let vendorName = 'LLM';
      let freelancerId: number | undefined;

      if (project.freelancerId) {
        const fl = await Collections.freelancers(db).findOne({ freelancerId: project.freelancerId });
        if (fl) {
          vendorName = fl.name;
          freelancerId = fl.freelancerId;
        }
      }

      const poId = await nextId(db, 'po');
      const processId = `PO-${projectId}-${costId}`;

      const po: PurchaseOrder = {
        poId,
        costId,
        projectId,
        freelancerId,
        vendorName,
        amount: cost.amount,
        currency: cost.currency,
        processId,
        createdAt: new Date(),
      };

      await Collections.purchaseOrders(db).insertOne(po);

      // Rosetta reads only processId from GeneratePurchaseOrderResponse
      return reply.status(201).send({ processId });
    },
  );

  // GET /:projectId/costs/:costId/pos — full DownloadPurchaseOrderResponse shape
  fastify.get<{
    Params: { projectId: string; costId: string };
    Querystring: { processId?: string };
  }>(
    `${BASE}/costs/:costId/pos`,
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const costId = parseInt(request.params.costId, 10);
      const db = fastify.mongo;

      const [cost, po] = await Promise.all([
        Collections.costs(db).findOne({ costId, projectId }),
        Collections.purchaseOrders(db).findOne({ costId, projectId }),
      ]);

      if (!cost || !po) return reply.status(404).send({ error: 'PO not found' });

      let vendorFirstName = 'LLM';
      let vendorLastName = '';

      if (po.freelancerId) {
        const fl = await Collections.freelancers(db).findOne({ freelancerId: po.freelancerId });
        if (fl) {
          const [first, ...rest] = fl.name.split('-');
          vendorFirstName = first ?? fl.name;
          vendorLastName = rest.join('-');
        }
      }

      const proj = await Collections.projects(db).findOne({ projectId });

      // Shape matches rosetta's DownloadPurchaseOrderResponse
      // rosetta reads: vendor.firstName, vendor.lastName
      return reply.send({
        generalInfo: {
          number: po.processId,
          date: po.createdAt.getTime(),
          currency: po.currency,
          project: {
            name: proj?.name ?? '',
            sourceLanguage: proj?.sourceLanguage ?? 'EN',
            targetLanguages: proj ? [proj.targetLanguage] : [],
            workflowSteps: [],
            dueDate: 0,
            projectManager: { id: 1, name: 'Mercury', email: 'system@mercury.internal' },
            subjectMatter: '',
          },
          calculationSource: '',
        },
        vendor: {
          firstName: vendorFirstName,
          lastName: vendorLastName,
        },
        requestor: { username: 'system' },
        totalCostWithFees: {
          managementFee: '0',
          minPricePadding: '0',
          fixedPrice: '0',
          total: po.amount.toFixed(2),
        },
        costDetails: {},
        customFields: {},
      });
    },
  );

  // GET /:projectId/custom-fields — CE-ID field definition
  fastify.get<{ Params: { projectId: string } }>(
    `${BASE}/custom-fields`,
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const project = await Collections.projects(fastify.mongo).findOne({ projectId });
      if (!project) return reply.status(404).send({ error: 'Project not found' });

      return reply.send([
        { id: 81050136, name: 'CE ID', type: 'TEXT', value: project.referenceId ?? '' },
      ]);
    },
  );

  // POST /:projectId/custom-fields — update custom fields; stores CE ID (field 81050136) as referenceId
  fastify.post<{ Params: { projectId: string } }>(
    `${BASE}/custom-fields`,
    async (request, reply) => {
      const projectId = parseInt(request.params.projectId, 10);
      const db = fastify.mongo;
      const fields = request.body as Array<{ id: string | number; value: { value: string } }> | undefined;
      if (Array.isArray(fields)) {
        const ceId = fields.find((f) => String(f.id) === '81050136');
        if (ceId?.value?.value !== undefined) {
          await Collections.projects(db).updateOne(
            { projectId },
            { $set: { referenceId: ceId.value.value, updatedAt: new Date() } },
          );
        }
      }
      return reply.send({ success: true });
    },
  );
};

export default xtmCostRoutes;
