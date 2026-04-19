import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ICollector, IndicatorPayload } from '../collector.interface';

interface EodhdQuote {
  code: string;
  timestamp: number;
  close: number;
  open: number;
}

const TICKERS = ['BBCA', 'ERAA'] as const;

@Injectable()
export class IdxPriceCollector implements ICollector {
  readonly indicatorCode = 'IDX_PRICE';
  readonly layer = 'stock' as const;
  readonly source = 'EODHD';

  private readonly logger = new Logger(IdxPriceCollector.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.getOrThrow<string>('EODHD_API_KEY');
  }

  async collect(): Promise<IndicatorPayload[]> {
    const results = await Promise.all(TICKERS.map((ticker) => this.fetchTicker(ticker)));
    const payloads = results.filter((p): p is IndicatorPayload => p !== null);

    if (payloads.length === 0) {
      this.logger.error('IdxPriceCollector returned no prices');
    }

    return payloads;
  }

  private async fetchTicker(ticker: string): Promise<IndicatorPayload | null> {
    const url = `https://eodhd.com/api/real-time/${ticker}.JK`;

    const response = await axios.get<EodhdQuote>(url, {
      timeout: 30_000,
      params: { api_token: this.apiKey, fmt: 'json' },
    });

    const quote = response.data;
    const price = quote?.close ?? quote?.open;

    if (price == null || isNaN(price)) {
      this.logger.warn(`Missing price for ${ticker} in EODHD response`);
      return null;
    }

    const periodDate = quote.timestamp ? new Date(quote.timestamp * 1000) : new Date();

    return {
      code: `PRICE_${ticker}`,
      value: price,
      unit: 'IDR',
      periodDate,
    };
  }
}
