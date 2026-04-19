import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ICollector, IndicatorPayload } from '../collector.interface';

interface FredObservation {
  date: string;
  value: string;
}

interface FredResponse {
  observations: FredObservation[];
}

@Injectable()
export class FredCollector implements ICollector {
  readonly indicatorCode = 'IDR_USD';
  readonly layer = 'macro' as const;
  readonly source = 'FRED';

  private readonly logger = new Logger(FredCollector.name);
  private readonly apiKey: string;
  // DEXINUS: USD/IDR spot rate from FRED — we invert to get IDR per 1 USD
  private readonly seriesId = 'DEXINUS';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.getOrThrow<string>('FRED_API_KEY');
  }

  async collect(): Promise<IndicatorPayload[]> {
    const url = 'https://api.stlouisfed.org/fred/series/observations';
    const response = await axios.get<FredResponse>(url, {
      timeout: 30_000,
      params: {
        series_id: this.seriesId,
        api_key: this.apiKey,
        file_type: 'json',
        sort_order: 'desc',
        limit: 1,
        observation_start: this.thirtyDaysAgo(),
      },
    });

    const observations = response.data?.observations ?? [];
    const payloads: IndicatorPayload[] = [];

    for (const obs of observations) {
      if (obs.value === '.' || obs.value === '') continue;

      const value = parseFloat(obs.value);
      if (isNaN(value)) continue;

      payloads.push({
        code: this.indicatorCode,
        value,
        unit: 'IDR/USD',
        periodDate: new Date(obs.date),
      });
    }

    if (payloads.length === 0) {
      this.logger.warn('FRED returned no usable IDR/USD observations');
    }

    return payloads;
  }

  private thirtyDaysAgo(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }
}
