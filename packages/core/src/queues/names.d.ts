export declare const QUEUES: {
    readonly TRANSLATE: "translate";
    readonly WEBHOOK: "webhook";
    readonly COST_PO: "cost-po";
};
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
