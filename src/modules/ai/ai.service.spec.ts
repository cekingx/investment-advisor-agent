import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AIService } from './ai.service';
import type { IndicatorSnapshot } from '../../temporal/temporal.types';

const mockSnapshot: IndicatorSnapshot = {
  macro: [
    { code: 'BI_RATE', value: 6.0, unit: '%', periodDate: '2026-04-25' },
    { code: 'IDR_USD', value: 16250, unit: 'IDR/USD', periodDate: '2026-04-25' },
  ],
  sectoral: [
    { sector: 'banking', code: 'NPL_BANKING', value: 2.1, unit: '%', periodDate: '2026-03-01' },
  ],
  stock: [
    { ticker: 'BBCA', code: 'PRICE_BBCA', value: 9000, unit: 'IDR', periodDate: '2026-04-25' },
    { ticker: 'ERAA', code: 'PRICE_ERAA', value: 520, unit: 'IDR', periodDate: '2026-04-25' },
  ],
};

function mockFetchResponse(text: string) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        choices: [{ message: { role: 'assistant', content: text } }],
      }),
  } as Response);
}

function mockFetchError(status: number, bodyText: string) {
  return Promise.resolve({
    ok: false,
    status,
    text: () => Promise.resolve(bodyText),
  } as Response);
}

describe('AIService', () => {
  let service: AIService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() =>
      mockFetchResponse('  *Digest* text  '),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              const map: Record<string, string> = {
                MODEL_FAST: 'fast-model',
                MODEL_SMART: 'smart-model',
                LLM_BASE_URL: 'https://llm.example.com/v1',
                LLM_API_KEY: 'test-api-key',
              };
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AIService>(AIService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('analyzeStock', () => {
    it('should call chat completions with correct model and prompt for BBCA', async () => {
      fetchSpy.mockImplementation(() => mockFetchResponse('  *BBCA* digest text  '));

      const result = await service.analyzeStock('BBCA', mockSnapshot);

      expect(result).toBe('*BBCA* digest text');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://llm.example.com/v1/chat/completions');
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe('fast-model');
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toContain('Output ONLY the final digest');
      expect(body.messages[1].role).toBe('user');
      expect(body.messages[1].content).toContain('Ticker: BBCA');
      expect(body.messages[1].content).toContain('PRICE_BBCA: 9000 IDR');
      expect(body.messages[1].content).not.toContain('PRICE_ERAA');
      expect(body.temperature).toBe(0.4);
      expect(body.max_tokens).toBe(4096);
    });

    it('should call chat completions with correct model and prompt for ERAA', async () => {
      fetchSpy.mockImplementation(() => mockFetchResponse('  *ERAA* digest text  '));

      const result = await service.analyzeStock('ERAA', mockSnapshot);

      expect(result).toBe('*ERAA* digest text');

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.messages[1].content).toContain('Ticker: ERAA');
      expect(body.messages[1].content).toContain('PRICE_ERAA: 520 IDR');
      expect(body.messages[1].content).not.toContain('PRICE_BBCA');
    });

    it('should include macro and sectoral data in prompt', async () => {
      fetchSpy.mockImplementation(() => mockFetchResponse('digest'));

      await service.analyzeStock('BBCA', mockSnapshot);

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.messages[1].content).toContain('BI_RATE: 6 %');
      expect(body.messages[1].content).toContain('IDR_USD: 16250 IDR/USD');
      expect(body.messages[1].content).toContain('banking / NPL_BANKING: 2.1 %');
    });

    it('should handle empty sectoral data gracefully', async () => {
      fetchSpy.mockImplementation(() => mockFetchResponse('digest'));
      const sparseSnapshot: IndicatorSnapshot = {
        macro: [{ code: 'BI_RATE', value: 6.0, unit: '%', periodDate: '2026-04-25' }],
        sectoral: [],
        stock: [{ ticker: 'BBCA', code: 'PRICE_BBCA', value: 9000, unit: 'IDR', periodDate: '2026-04-25' }],
      };

      await service.analyzeStock('BBCA', sparseSnapshot);

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.messages[1].content).toContain('No sectoral data available');
    });

    it('should propagate HTTP errors from LLM API', async () => {
      fetchSpy.mockImplementation(() => mockFetchError(429, 'rate limited'));

      await expect(service.analyzeStock('BBCA', mockSnapshot)).rejects.toThrow(
        'LLM API error 429: rate limited',
      );
    });

    it('should throw if response body is empty or malformed', async () => {
      fetchSpy.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ choices: [] }),
        } as Response),
      );

      await expect(service.analyzeStock('BBCA', mockSnapshot)).rejects.toThrow(
        'LLM API returned empty or malformed response',
      );
    });

    it('should throw if MODEL_FAST is missing', async () => {
      const badModule = await Test.createTestingModule({
        providers: [
          AIService,
          {
            provide: ConfigService,
            useValue: {
              getOrThrow: jest.fn((key: string) => {
                if (key === 'MODEL_FAST') throw new Error('Missing MODEL_FAST');
                return 'val';
              }),
            },
          },
        ],
      }).compile();

      const badService = badModule.get<AIService>(AIService);
      await expect(badService.analyzeStock('BBCA', mockSnapshot)).rejects.toThrow('Missing MODEL_FAST');
    });
  });

  describe('generateWeeklySummary', () => {
    it('should call chat completions with MODEL_SMART and daily analyses', async () => {
      fetchSpy.mockImplementation(() => mockFetchResponse('  Weekly summary text  '));

      const analyses = ['Day 1 BBCA text', 'Day 2 ERAA text'];
      const result = await service.generateWeeklySummary(analyses);

      expect(result).toBe('Weekly summary text');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe('smart-model');
      expect(body.messages[0].content).toContain('Output ONLY the final digest');
      expect(body.messages[1].content).toContain('Day 1');
      expect(body.messages[1].content).toContain('Day 2');
      expect(body.messages[1].content).toContain('Day 1 BBCA text');
      expect(body.temperature).toBe(0.5);
      expect(body.max_tokens).toBe(8192);
    });

    it('should throw when no analyses are provided', async () => {
      await expect(service.generateWeeklySummary([])).rejects.toThrow(
        'No daily analyses provided for weekly summary',
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should propagate HTTP errors from LLM API', async () => {
      fetchSpy.mockImplementation(() => mockFetchError(500, 'Internal Server Error'));

      await expect(service.generateWeeklySummary(['a'])).rejects.toThrow(
        'LLM API error 500: Internal Server Error',
      );
    });
  });
});
