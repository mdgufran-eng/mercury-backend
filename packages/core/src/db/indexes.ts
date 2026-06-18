import { Db } from 'mongodb';
import * as Collections from './collections.js';

export async function createIndexes(db: Db): Promise<void> {
  await Promise.all([
    Collections.projects(db).createIndex({ projectId: 1 }, { unique: true }),
    Collections.projects(db).createIndex({ name: 1 }, { unique: true }),
    Collections.projects(db).createIndex({ customerId: 1 }),

    Collections.jobs(db).createIndex({ jobId: 1 }, { unique: true }),
    Collections.jobs(db).createIndex({ projectId: 1 }),
    Collections.jobs(db).createIndex({ status: 1 }),

    Collections.segments(db).createIndex({ segmentId: 1 }, { unique: true }),
    Collections.segments(db).createIndex({ jobId: 1 }),
    Collections.segments(db).createIndex({ projectId: 1 }),

Collections.callbackLogs(db).createIndex({ projectId: 1 }),
    Collections.callbackLogs(db).createIndex({ success: 1 }),
    Collections.callbackLogs(db).createIndex({ callbackId: 1 }, { unique: true }),

    Collections.costs(db).createIndex({ projectId: 1 }),
    Collections.costs(db).createIndex({ costId: 1 }, { unique: true }),

    Collections.purchaseOrders(db).createIndex({ costId: 1 }),
    Collections.purchaseOrders(db).createIndex({ processId: 1 }, { unique: true }),
  ]);
}