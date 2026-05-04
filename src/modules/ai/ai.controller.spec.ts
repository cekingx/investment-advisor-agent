import { Test, TestingModule } from '@nestjs/testing';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { IndicatorService } from '../indicator/indicator.service';
import type { IndicatorSnapshot } from '../../temporal/temporal.types';

const mockSnapshot: IndicatorSnapshot = {
  macro: [
    { code: 'BI_RATE', value: 6.0, unit: '%', periodDate: '2026-04-25' },
  ],
  sectoral: [],
  stock: [
    { ticker: 'BBCA', code: 'PRICE_BBCA', value: 9000, unit: 'IDR', periodDate: '2026-04-25' },
  ],
};

describe('AIController', () => {
  let controller: AIController;
  let aiService: jest.Mocked<AIService>;
  let indicatorService: jest.Mocked<IndicatorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIController],
      providers: [
        {
          provide: AIService,
          useValue: { analyzeStock: jest.fn() },
        },
        {
          provide: IndicatorService,
          useValue: { getLatestSnapshot: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AIController>(AIController);
    aiService = module.get(AIService);
    indicatorService = module.get(IndicatorService);
  });

  it('should return analysis text for BBCA', async () => {
    indicatorService.getLatestSnapshot.mockResolvedValue(mockSnapshot);
    aiService.analyzeStock.mockResolvedValue('*BBCA* looks good today.');

    const result = await controller.analyzeStock('BBCA');

    expect(result).toBe('*BBCA* looks good today.');
    expect(indicatorService.getLatestSnapshot).toHaveBeenCalledTimes(1);
    expect(aiService.analyzeStock).toHaveBeenCalledWith('BBCA', mockSnapshot);
  });

  it('should return analysis text for ERAA', async () => {
    indicatorService.getLatestSnapshot.mockResolvedValue(mockSnapshot);
    aiService.analyzeStock.mockResolvedValue('*ERAA* analysis result.');

    const result = await controller.analyzeStock('ERAA');

    expect(aiService.analyzeStock).toHaveBeenCalledWith('ERAA', mockSnapshot);
  });

  it('should propagate errors from AIService', async () => {
    indicatorService.getLatestSnapshot.mockResolvedValue(mockSnapshot);
    aiService.analyzeStock.mockRejectedValue(new Error('LLM down'));

    await expect(controller.analyzeStock('BBCA')).rejects.toThrow('LLM down');
  });
});
