const mockFetchLatestIndicators = jest.fn();
const mockAnalyzeStocks = jest.fn();
const mockSendTelegramMessage = jest.fn();
const mockSendErrorNotification = jest.fn();

jest.mock('@temporalio/workflow', () => ({
  proxyActivities: jest.fn(() => ({
    fetchLatestIndicators: mockFetchLatestIndicators,
    analyzeStocks: mockAnalyzeStocks,
    sendTelegramMessage: mockSendTelegramMessage,
    sendErrorNotification: mockSendErrorNotification,
  })),
}));

import { analyzeDailyWorkflow, onDemandAnalysisWorkflow } from './analyze.workflow';
import type { IndicatorSnapshot } from '../temporal.types';

const mockSnapshot: IndicatorSnapshot = {
  macro: [{ code: 'BI_RATE', value: 6.0, unit: '%', periodDate: '2026-04-25' }],
  sectoral: [],
  stock: [{ ticker: 'BBCA', code: 'PRICE_BBCA', value: 9000, unit: 'IDR', periodDate: '2026-04-25' }],
};

describe('analyzeDailyWorkflow', () => {
  const chatId = 12345;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchLatestIndicators.mockResolvedValue(mockSnapshot);
    mockAnalyzeStocks.mockResolvedValue('Analysis result');
    mockSendTelegramMessage.mockResolvedValue(undefined);
    mockSendErrorNotification.mockResolvedValue(undefined);
  });

  it('should fetch indicators, analyze stocks, and send message on happy path', async () => {
    await analyzeDailyWorkflow(chatId);

    expect(mockFetchLatestIndicators).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeStocks).toHaveBeenCalledWith(chatId, mockSnapshot);
    expect(mockSendTelegramMessage).toHaveBeenCalledWith(chatId, 'Analysis result');
  });

  it('should not call sendErrorNotification on happy path', async () => {
    await analyzeDailyWorkflow(chatId);

    expect(mockSendErrorNotification).not.toHaveBeenCalled();
  });

  it('should call steps in order: fetchIndicators → analyzeStocks → sendTelegramMessage', async () => {
    await analyzeDailyWorkflow(chatId);

    const fetchOrder = mockFetchLatestIndicators.mock.invocationCallOrder[0];
    const analyzeOrder = mockAnalyzeStocks.mock.invocationCallOrder[0];
    const sendOrder = mockSendTelegramMessage.mock.invocationCallOrder[0];

    expect(fetchOrder).toBeLessThan(analyzeOrder);
    expect(analyzeOrder).toBeLessThan(sendOrder);
  });

  it('should send error notification when fetchLatestIndicators throws', async () => {
    mockFetchLatestIndicators.mockRejectedValue(new Error('DB connection failed'));

    await analyzeDailyWorkflow(chatId);

    expect(mockSendErrorNotification).toHaveBeenCalledWith(chatId, 'DB connection failed');
    expect(mockSendTelegramMessage).not.toHaveBeenCalled();
  });

  it('should send error notification when analyzeStocks throws', async () => {
    mockAnalyzeStocks.mockRejectedValue(new Error('LLM error'));

    await analyzeDailyWorkflow(chatId);

    expect(mockSendErrorNotification).toHaveBeenCalledWith(chatId, 'LLM error');
    expect(mockSendTelegramMessage).not.toHaveBeenCalled();
  });

  it('should send error notification when sendTelegramMessage throws', async () => {
    mockSendTelegramMessage.mockRejectedValue(new Error('Telegram API error'));

    await analyzeDailyWorkflow(chatId);

    expect(mockSendErrorNotification).toHaveBeenCalledWith(chatId, 'Telegram API error');
  });

  it('should stringify non-Error thrown values in error notification', async () => {
    mockFetchLatestIndicators.mockRejectedValue('plain string error');

    await analyzeDailyWorkflow(chatId);

    expect(mockSendErrorNotification).toHaveBeenCalledWith(chatId, 'plain string error');
  });

  it('should pass the correct chatId to all activity calls', async () => {
    const specificChatId = 99999;
    await analyzeDailyWorkflow(specificChatId);

    expect(mockAnalyzeStocks).toHaveBeenCalledWith(specificChatId, expect.any(Object));
    expect(mockSendTelegramMessage).toHaveBeenCalledWith(specificChatId, expect.any(String));
  });
});

describe('onDemandAnalysisWorkflow', () => {
  const chatId = 77777;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchLatestIndicators.mockResolvedValue(mockSnapshot);
    mockAnalyzeStocks.mockResolvedValue('On-demand analysis');
    mockSendTelegramMessage.mockResolvedValue(undefined);
    mockSendErrorNotification.mockResolvedValue(undefined);
  });

  it('should execute the full fetch → analyze → send pipeline', async () => {
    await onDemandAnalysisWorkflow(chatId);

    expect(mockFetchLatestIndicators).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeStocks).toHaveBeenCalledWith(chatId, mockSnapshot);
    expect(mockSendTelegramMessage).toHaveBeenCalledWith(chatId, 'On-demand analysis');
  });

  it('should send error notification on failure', async () => {
    mockAnalyzeStocks.mockRejectedValue(new Error('timeout'));

    await onDemandAnalysisWorkflow(chatId);

    expect(mockSendErrorNotification).toHaveBeenCalledWith(chatId, 'timeout');
  });
});
