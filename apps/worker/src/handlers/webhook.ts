import { Job } from 'bullmq';
import axios from 'axios';
import { Db } from 'mongodb';
import { Collections } from '@mercury/core';
import type { WebhookJobData } from '@mercury/core';

export type { WebhookJobData };

export async function handleWebhook(job: Job<WebhookJobData>, db: Db): Promise<void> {
  const { callbackId, projectId, event, url, method, headers, body } = job.data;

  const now = new Date();

  try {
    const response = await axios({
      method,
      url,
      headers: headers ?? {},
      data: body,
      timeout: 10_000,
      validateStatus: () => true, // handle all statuses manually
    });

    const success = response.status >= 200 && response.status < 300;

    await Collections.callbackLogs(db).updateOne(
      { callbackId },
      {
        $set: {
          responseStatus: response.status,
          success,
          lastAttemptAt: now,
        },
        $inc: { attempts: 1 },
      },
    );

    if (!success) {
      throw new Error(
        `Callback ${event} to ${url} failed with status ${response.status} (projectId=${projectId})`,
      );
    }

    job.log(`Delivered ${event} → ${url} [${response.status}]`);
  } catch (err) {
    await Collections.callbackLogs(db).updateOne(
      { callbackId },
      { $set: { lastAttemptAt: now }, $inc: { attempts: 1 } },
    );
    throw err;
  }
}
