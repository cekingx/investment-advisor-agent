import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Telegraf, Context } from 'telegraf';
import { TelegramService } from './telegram.service';
import { User } from '../../database/entities/user.entity';
import { TemporalService } from '../../temporal/temporal.service';
import { IndicatorService } from '../indicator/indicator.service';
import { IndicatorSnapshot } from '../../temporal/temporal.types';

describe('TelegramService', () => {
  let service: TelegramService;
  let userRepo: { upsert: jest.Mock; findOne: jest.Mock };
  let temporalService: { startWorkflow: jest.Mock };
  let indicatorService: { getLatestSnapshot: jest.Mock };
  let configService: { get: jest.Mock; getOrThrow: jest.Mock };

  const createCtx = (overrides?: Partial<Context>): Context =>
    ({
      chat: { id: 12345 },
      reply: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    } as unknown as Context);

  beforeEach(async () => {
    userRepo = { upsert: jest.fn().mockResolvedValue(undefined), findOne: jest.fn() };
    temporalService = { startWorkflow: jest.fn().mockResolvedValue(undefined) };
    indicatorService = { getLatestSnapshot: jest.fn() };
    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'TEMPORAL_TASK_QUEUE') return defaultValue ?? 'investment-advisor';
        return defaultValue ?? undefined;
      }),
      getOrThrow: jest.fn().mockReturnValue('fake-bot-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: TemporalService, useValue: temporalService },
        { provide: IndicatorService, useValue: indicatorService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(TelegramService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onStart', () => {
    it('should upsert user as subscribed and reply with confirmation', async () => {
      const ctx = createCtx();

      await service.onStart(ctx);

      expect(userRepo.upsert).toHaveBeenCalledWith(
        { chatId: 12345, subscribed: true },
        { conflictPaths: ['chatId'] },
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('You are now subscribed'),
      );
    });
  });

  describe('onStop', () => {
    it('should upsert user as unsubscribed and reply with confirmation', async () => {
      const ctx = createCtx();

      await service.onStop(ctx);

      expect(userRepo.upsert).toHaveBeenCalledWith(
        { chatId: 12345, subscribed: false },
        { conflictPaths: ['chatId'] },
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Subscription deactivated'),
      );
    });
  });

  describe('onHelp', () => {
    it('should reply with command list and schedule', async () => {
      const ctx = createCtx();

      await service.onHelp(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('/analyze'),
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('/latest'),
      );
    });
  });

  describe('onAnalyze', () => {
    it('should reply with acknowledgement and start on-demand workflow', async () => {
      configService.get.mockReturnValue('investment-advisor');
      const ctx = createCtx();

      await service.onAnalyze(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Fetching latest analysis'),
      );
      expect(temporalService.startWorkflow).toHaveBeenCalledWith(
        'onDemandAnalysisWorkflow',
        expect.objectContaining({
          workflowId: expect.stringContaining('analyze-ondemand-12345-'),
          taskQueue: 'investment-advisor',
          args: [12345],
        }),
      );
    });

    it('should use default task queue when env var is missing', async () => {
      const ctx = createCtx();

      await service.onAnalyze(ctx);

      expect(temporalService.startWorkflow).toHaveBeenCalledWith(
        'onDemandAnalysisWorkflow',
        expect.objectContaining({
          taskQueue: 'investment-advisor',
        }),
      );
    });

    it('should not throw if workflow start fails (fire-and-forget)', async () => {
      configService.get.mockReturnValue('investment-advisor');
      temporalService.startWorkflow.mockRejectedValue(new Error('Temporal down'));
      const ctx = createCtx();

      await expect(service.onAnalyze(ctx)).resolves.toBeUndefined();
      expect(ctx.reply).toHaveBeenCalled(); // acknowledgement still sent
    });
  });

  describe('onLatest', () => {
    it('should reply with formatted indicators when data exists', async () => {
      const snapshot: IndicatorSnapshot = {
        macro: [
          { code: 'BI_RATE', value: 6.0, unit: '%', periodDate: '2024-01-15T00:00:00.000Z' },
          { code: 'IDR_USD', value: 15500, unit: 'IDR', periodDate: '2024-01-15T00:00:00.000Z' },
        ],
        sectoral: [],
        stock: [
          { ticker: 'BBCA', code: 'PRICE_BBCA', value: 8750, unit: 'IDR', periodDate: '2024-01-15T00:00:00.000Z' },
        ],
      };
      indicatorService.getLatestSnapshot.mockResolvedValue(snapshot);
      const ctx = createCtx();

      await service.onLatest(ctx);

      expect(indicatorService.getLatestSnapshot).toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('BI_RATE'),
        { parse_mode: 'Markdown' },
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('PRICE_BBCA'),
        { parse_mode: 'Markdown' },
      );
    });

    it('should reply with empty message when no indicators exist', async () => {
      const snapshot: IndicatorSnapshot = { macro: [], sectoral: [], stock: [] };
      indicatorService.getLatestSnapshot.mockResolvedValue(snapshot);
      const ctx = createCtx();

      await service.onLatest(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('No indicators have been collected yet'),
        { parse_mode: 'Markdown' },
      );
    });
  });

  describe('onModuleInit', () => {
    it('should set webhook when TELEGRAM_WEBHOOK_URL is configured', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'TELEGRAM_WEBHOOK_URL' ? 'https://example.com/telegram/webhook' : undefined,
      );
      const setWebhookSpy = jest
        .spyOn(service.bot.telegram, 'setWebhook')
        .mockResolvedValue(true);

      await service.onModuleInit();

      expect(setWebhookSpy).toHaveBeenCalledWith('https://example.com/telegram/webhook');
      setWebhookSpy.mockRestore();
    });

    it('should skip webhook setup when TELEGRAM_WEBHOOK_URL is absent', async () => {
      configService.get.mockReturnValue(undefined);
      const setWebhookSpy = jest
        .spyOn(service.bot.telegram, 'setWebhook')
        .mockResolvedValue(true);

      await service.onModuleInit();

      expect(setWebhookSpy).not.toHaveBeenCalled();
      setWebhookSpy.mockRestore();
    });
  });
});
