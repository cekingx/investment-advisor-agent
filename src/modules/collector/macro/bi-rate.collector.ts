import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import { ICollector, IndicatorPayload } from '../collector.interface';

@Injectable()
export class BiRateCollector implements ICollector {
  readonly indicatorCode = 'BI_RATE';
  readonly layer = 'macro' as const;
  readonly source = 'bi.go.id';

  private readonly logger = new Logger(BiRateCollector.name);
  private readonly delayMs: number;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.delayMs = this.config.get<number>('SCRAPER_DELAY_MS', 2000);
  }

  async collect(): Promise<IndicatorPayload[]> {
    await new Promise((r) => setTimeout(r, this.delayMs));

    const url = 'https://www.bi.go.id/id/statistik/indikator/bi-rate.aspx';
    const response = await firstValueFrom(
      this.http.get<string>(url, {
        timeout: 30_000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InvestmentAdvisorBot/1.0)' },
      }),
    );

    const $ = cheerio.load(response.data);
    const result = this.parse($);

    if (result.length === 0) {
      this.logger.error('BI Rate parse returned no data — HTML structure may have changed');
      this.logger.debug(response.data.slice(0, 2000));
    }

    return result;
  }

  private parse($: cheerio.CheerioAPI): IndicatorPayload[] {
    const payloads: IndicatorPayload[] = [];

    // BI Rate page renders a table with date and rate columns
    $('table tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return;

      const dateText = $(cells[0]).text().trim();
      const rateText = $(cells[1]).text().trim().replace(',', '.');

      const periodDate = this.parseDate(dateText);
      const value = parseFloat(rateText);

      if (!periodDate || isNaN(value)) return;

      payloads.push({ code: this.indicatorCode, value, unit: '%', periodDate });
    });

    // Return only the most recent entry
    return payloads.slice(0, 1);
  }

  private parseDate(text: string): Date | null {
    // Handles formats: "19 April 2025", "April 2025", "Apr-25"
    const cleaned = text.replace(/\s+/g, ' ').trim();
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) return parsed;

    // Indonesian month name fallback
    const months: Record<string, string> = {
      januari: 'January', februari: 'February', maret: 'March',
      april: 'April', mei: 'May', juni: 'June', juli: 'July',
      agustus: 'August', september: 'September', oktober: 'October',
      november: 'November', desember: 'December',
    };
    const normalized = cleaned.toLowerCase().replace(
      /\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/,
      (m) => months[m],
    );
    const fallback = new Date(normalized);
    return isNaN(fallback.getTime()) ? null : fallback;
  }
}
