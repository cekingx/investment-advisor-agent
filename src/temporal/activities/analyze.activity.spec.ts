import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyzeActivity } from './analyze.activity';
import { IndicatorService } from '../../modules/indicator/indicator.service';
import { AIService } from '../../modules/ai/ai.service';
import { Analysis } from '../../database/entities/analysis.entity';
import { User } from '../../database/entities/user.entity';
import type { IndicatorSnapshot } from '../temporal.types';

const mockSnapshot: IndicatorSnapshot = {
  macro: [{ code: 'BI_RATE', value: 6.0, unit: '%', periodDate: '2026-04-25' }],
  sectoral: [{ sector: 'banking', code: 'NPL_BANKING', value: 2.1, unit: '%', periodDate: '2026-03-01' }],
  stock: [
    { ticker: 'BBCA', code: 'PRICE_BBCA', value: 9000, unit: 'IDR', periodDate: '2026-04-25' },
    { ticker: 'ERAA', code: 'PRICE_ERAA', value: 520, unit: 'IDR', periodDate: '2026-04-25' },
  ],
};

describe('AnalyzeActivity', () => {
  let activity: AnalyzeActivity;
  let indicatorService: jest.Mocked<IndicatorService>;
  let aiService: jest.Mocked<AIService>;
  let analysisRepo: { save: jest.Mock };
  let userRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyzeActivity,
        {
          provide: IndicatorService,
          useValue: { getLatestSnapshot: jest.fn() },
        },
        {
          provide: AIService,
          useValue: { analyzeStock: jest.fn() },
        },
        {
          provide: getRepositoryToken(Analysis),
          useValue: { save: jest.fn() },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    activity = module.get(AnalyzeActivity);
    indicatorService = module.get(IndicatorService);
    aiService = module.get(AIService);
    analysisRepo = module.get(getRepositoryToken(Analysis));
    userRepo = module.get(getRepositoryToken(User));
  });

  describe('fetchLatestIndicators', () => {
    it('should return the snapshot from IndicatorService', async () => {
      indicatorService.getLatestSnapshot.mockResolvedValue(mockSnapshot);

      const result = await activity.fetchLatestIndicators();

      expect(result).toEqual(mockSnapshot);
      expect(indicatorService.getLatestSnapshot).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from IndicatorService', async () => {
      indicatorService.getLatestSnapshot.mockRejectedValue(new Error('DB error'));

      await expect(activity.fetchLatestIndicators()).rejects.toThrow('DB error');
    });
  });

  describe('analyzeStocks', () => {
    const chatId = 12345;
    const user = { id: 'user-uuid', chatId } as User;

    beforeEach(() => {
      userRepo.findOne.mockResolvedValue(user);
      aiService.analyzeStock
        .mockResolvedValueOnce('*BBCA* analysis text')
        .mockResolvedValueOnce('*ERAA* analysis text');
      analysisRepo.save.mockResolvedValue({});
    });

    it('should analyze both BBCA and ERAA', async () => {
      await activity.analyzeStocks(chatId, mockSnapshot);

      expect(aiService.analyzeStock).toHaveBeenCalledWith('BBCA', mockSnapshot);
      expect(aiService.analyzeStock).toHaveBeenCalledWith('ERAA', mockSnapshot);
    });

    it('should return combined analysis text for both tickers', async () => {
      const result = await activity.analyzeStocks(chatId, mockSnapshot);

      expect(result).toContain('BBCA');
      expect(result).toContain('ERAA');
    });

    it('should save a daily analysis record for each ticker when user exists', async () => {
      await activity.analyzeStocks(chatId, mockSnapshot);

      expect(analysisRepo.save).toHaveBeenCalledTimes(2);
      expect(analysisRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ user, type: 'daily', content: '*BBCA* analysis text' }),
      );
      expect(analysisRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ user, type: 'daily', content: '*ERAA* analysis text' }),
      );
    });

    it('should look up user by chatId', async () => {
      await activity.analyzeStocks(chatId, mockSnapshot);

      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { chatId } });
    });

    it('should skip saving when user is not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      aiService.analyzeStock.mockResolvedValue('analysis');

      await activity.analyzeStocks(chatId, mockSnapshot);

      expect(analysisRepo.save).not.toHaveBeenCalled();
    });

    it('should propagate errors from AIService', async () => {
      aiService.analyzeStock.mockReset();
      aiService.analyzeStock.mockRejectedValue(new Error('LLM unavailable'));

      await expect(activity.analyzeStocks(chatId, mockSnapshot)).rejects.toThrow('LLM unavailable');
    });
  });
});
