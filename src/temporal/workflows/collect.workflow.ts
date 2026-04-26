import { proxyActivities, startChild } from '@temporalio/workflow';
import type { CollectActivities } from '../temporal.types';
import { analyzeDailyWorkflow } from './analyze.workflow';

const { collectBiRate, collectFred, collectIdxPrices, fetchSubscribedUsers } =
  proxyActivities<CollectActivities>({
    startToCloseTimeout: '3 minutes',
    retry: {
      maximumAttempts: 3,
      initialInterval: '10 seconds',
      backoffCoefficient: 2,
    },
  });

export async function collectDailyWorkflow(): Promise<void> {
  await collectBiRate();
  await collectFred();
  await collectIdxPrices();

  const chatIds = await fetchSubscribedUsers();

  await Promise.all(
    chatIds.map((chatId) =>
      startChild(analyzeDailyWorkflow, {
        workflowId: `analyze-daily-${chatId}-${Date.now()}`,
        args: [chatId],
      }),
    ),
  );
}
