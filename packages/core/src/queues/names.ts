export const QUEUES = {
  TRANSLATE: 'translate',
  WEBHOOK: 'webhook',
  COST_PO: 'cost-po',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
