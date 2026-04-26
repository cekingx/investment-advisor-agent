/**
 * Integration test: collect → analyze → send
 *
 * Tests the full activity chain by wiring all three activity classes together
 * with mocked external dependencies (HTTP, LLM, Telegram). Verifies that output
 * from each step is correctly passed to the next, matching the flow orchestrated
 * by collectDailyWorkflow + analyzeDailyWorkflow.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CollectActivity } from './activities/collect.activity';
import { AnalyzeActivity } from './activities/analyze.activity';
import { SendActivity } from './activities/send.activity';
import { CollectorService } from '../modules/collector/collector.service';
import { IndicatorService } from '../modules/indicator/indicator.service';
import { AIService } from '../modules/ai/ai.service';
import { TelegramService } from '../modules/telegram/telegram.service';
import { User } from '../database/entities/user.entity';
import { Analysis } from '../database/entities/analysis.entity';
import type { IndicatorSnapshot } from './temporal.types';

describe('Daily collect → analyze → send pipeline (integration)', () => {
  let collectActivity: CollectActivity;
  let analyzeActivity: AnalyzeActivity;
  let sendActivity: SendActivity;

  let mockCollectorService: { collectBiRate: jest.Mock; collectFred: jest.Mock; collectIdxPrices: jest.Mock };
  let mockIndicatorService: { getLatestSnapshot: jest.Mock };
  let mockAiService: { analyzeStock: jest.Mock };
  let mockTelegramService: { sendMessage: jest.Mock; sendErrorNotification: jest.Mock };
  let mockUserRepo: { find: jest.Mock; findOne: jest.Mock };
  let mockAnalysisRepo: { save: jest.Mock };

  const chatId = 12345;
  const user = { id: 'user-uuid', chatId } as User;

  const indicatorSnapshot: IndicatorSnapshot = {
    macro: [
      { code: 'BI_RATE', value: 6.0, unit: '%', periodDate: '2026-04-25' },
      { code: 'IDR_USD', value: 16300, unit: 'IDR', periodDate: '2026-04-25' },
    ],
    sectoral: [
      { sector: 'banking', code: 'NPL_BANKING', value: 2.1, unit: '%', periodDate: '2026-03-01' },
    ],
    stock: [
      { ticker: 'BBCA', code: 'PRICE_BBCA', value: 9000, unit: 'IDR', periodDate: '2026-04-25' },
      { ticker: 'ERAA', code: 'PRICE_ERAA', value: 520, unit: 'IDR', periodDate: '2026-04-25' },
    ],
  };

  beforeEach(async () => {
    mockCollectorService = {
      collectBiRate: jest.fn().mockResolvedValue(undefined),
      collectFred: jest.fn().mockResolvedValue(undefined),
      collectIdxPrices: jest.fn().mockResolvedValue(undefined),
    };
    mockIndicatorService = {
      getLatestSnapshot: jest.fn().mockResolvedValue(indicatorSnapshot),
    };
    mockAiService = {
      analyzeStock: jest.fn()
        .mockResolvedValueOnce('*BBCA* — BI Rate stable at 6%. Price: 9000 IDR. Outlook: positive.')
        .mockResolvedValueOnce('*ERAA* — Consumer confidence steady. Price: 520 IDR. Outlook: neutral.'),
    };
    mockTelegramService = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
      sendErrorNotification: jest.fn().mockResolvedValue(undefined),
    };
    mockUserRepo = {
      find: jest.fn().mockResolvedValue([user]),
      findOne: jest.fn().mockResolvedValue(user),
    };
    mockAnalysisRepo = {
      save: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectActivity,
        AnalyzeActivity,
        SendActivity,
        { provide: CollectorService, useValue: mockCollectorService },
        { provide: IndicatorService, useValue: mockIndicatorService },
        { provide: AIService, useValue: mockAiService },
        { provide: TelegramService, useValue: mockTelegramService },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Analysis), useValue: mockAnalysisRepo },
      ],
    }).compile();

    collectActivity = module.get(CollectActivity);
    analyzeActivity = module.get(AnalyzeActivity);
    sendActivity = module.get(SendActivity);
  });

  it('should complete the full pipeline and deliver analysis via Telegram', async () => {
    // Phase 1: collect
    await collectActivity.collectBiRate();
    await collectActivity.collectFred();
    await collectActivity.collectIdxPrices();

    expect(mockCollectorService.collectBiRate).toHaveBeenCalledTimes(1);
    expect(mockCollectorService.collectFred).toHaveBeenCalledTimes(1);
    expect(mockCollectorService.collectIdxPrices).toHaveBeenCalledTimes(1);

    // Phase 2: analyze
    const snapshot = await analyzeActivity.fetchLatestIndicators();
    const analysisText = await analyzeActivity.analyzeStocks(chatId, snapshot);

    expect(snapshot).toEqual(indicatorSnapshot);
    expect(mockAiService.analyzeStock).toHaveBeenCalledWith('BBCA', indicatorSnapshot);
    expect(mockAiService.analyzeStock).toHaveBeenCalledWith('ERAA', indicatorSnapshot);
    expect(analysisText).toContain('BBCA');
    expect(analysisText).toContain('ERAA');
    expect(mockAnalysisRepo.save).toHaveBeenCalledTimes(2);

    // Phase 3: send
    await sendActivity.sendTelegramMessage(chatId, analysisText);

    expect(mockTelegramService.sendMessage).toHaveBeenCalledWith(chatId, analysisText);
  });

  it('should identify subscribed users for workflow fan-out', async () => {
    const chatIds = await collectActivity.fetchSubscribedUsers();

    expect(chatIds).toContain(chatId);
    expect(mockUserRepo.find).toHaveBeenCalledWith({ where: { subscribed: true } });
  });

  it('should deliver error notification when AI analysis fails', async () => {
    mockAiService.analyzeStock.mockReset();
    mockAiService.analyzeStock.mockRejectedValue(new Error('LLM rate limit'));

    const snapshot = await analyzeActivity.fetchLatestIndicators();

    let caughtError: Error | null = null;
    try {
      await analyzeActivity.analyzeStocks(chatId, snapshot);
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).not.toBeNull();

    // Simulate workflow catch block → sendErrorNotification activity
    await sendActivity.sendErrorNotification(chatId, caughtError!.message);

    expect(mockTelegramService.sendErrorNotification).toHaveBeenCalledWith(chatId);
    expect(mockTelegramService.sendMessage).not.toHaveBeenCalled();
  });

  it('should complete silently when error notification itself fails', async () => {
    mockTelegramService.sendErrorNotification.mockRejectedValue(new Error('bot blocked'));

    // Must not throw — workflow catch block must always exit cleanly
    await expect(
      sendActivity.sendErrorNotification(chatId, 'analysis failed'),
    ).resolves.toBeUndefined();
  });

  it('should persist analysis records for both tickers', async () => {
    const snapshot = await analyzeActivity.fetchLatestIndicators();
    await analyzeActivity.analyzeStocks(chatId, snapshot);

    const savedCalls = mockAnalysisRepo.save.mock.calls;
    expect(savedCalls).toHaveLength(2);

    const savedTypes = savedCalls.map((c: any[]) => c[0].type);
    expect(savedTypes).toEqual(['daily', 'daily']);

    const savedTickers = savedCalls.map((c: any[]) => (c[0].content as string).includes('BBCA') ? 'BBCA' : 'ERAA');
    expect(savedTickers).toContain('BBCA');
    expect(savedTickers).toContain('ERAA');
  });
});
