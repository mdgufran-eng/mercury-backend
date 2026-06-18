import { Queue, type ConnectionOptions } from 'bullmq';
import { QUEUES } from '../queues/names.js';
import type { MessageBroker } from '../ports/MessageBroker.js';
import type { TranslateJobData, WebhookJobData, CostPoJobData } from '../types/jobPayloads.js';

export class BullMQBroker implements MessageBroker {
  private conn: ConnectionOptions;

  constructor(conn: ConnectionOptions) {
    this.conn = conn;
  }

  async enqueueTranslate(data: TranslateJobData): Promise<void> {
    await this.add(QUEUES.TRANSLATE, 'translate', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
    });
  }

  async enqueueWebhook(data: WebhookJobData): Promise<void> {
    await this.add(QUEUES.WEBHOOK, 'webhook', data, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
    });
  }

  async enqueueCostPo(data: CostPoJobData): Promise<void> {
    await this.add(QUEUES.COST_PO, 'cost-po', data);
  }

  private async add(
    queueName: string,
    jobName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    opts: Record<string, unknown> = {},
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = new Queue<any>(queueName, { connection: this.conn });
    await q.add(jobName, data, opts);
    await q.close();
  }
}
