import { proxyActivities } from '@temporalio/workflow';
import type { AnalyzeActivities, SendActivities } from '../temporal.types';

const { fetchLatestIndicators, analyzeStocks } = proxyActivities<AnalyzeActivities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '10 seconds',
    backoffCoefficient: 2,
  },
});

const { sendTelegramMessage, sendErrorNotification } = proxyActivities<SendActivities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 5,
    initialInterval: '5 seconds',
    backoffCoefficient: 1.5,
  },
});

export async function analyzeDailyWorkflow(chatId: number): Promise<void> {
  try {
    const snapshot = await fetchLatestIndicators();
    const text = await analyzeStocks(chatId, snapshot);
    await sendTelegramMessage(chatId, text);
  } catch (err) {
    await sendErrorNotification(chatId, err instanceof Error ? err.message : String(err));
  }
}

export async function onDemandAnalysisWorkflow(chatId: number): Promise<void> {
  await analyzeDailyWorkflow(chatId);
}
