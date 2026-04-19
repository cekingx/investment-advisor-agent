import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MacroIndicator } from '../../database/entities/macro-indicator.entity';
import { StockIndicator } from '../../database/entities/stock-indicator.entity';
import { IndicatorPayload } from './collector.interface';
import { BiRateCollector } from './macro/bi-rate.collector';
import { FredCollector } from './macro/fred.collector';
import { IdxPriceCollector } from './stock/idx-price.collector';

@Injectable()
export class CollectorService {
  private readonly logger = new Logger(CollectorService.name);

  constructor(
    @InjectRepository(MacroIndicator)
    private readonly macroRepo: Repository<MacroIndicator>,
    @InjectRepository(StockIndicator)
    private readonly stockRepo: Repository<StockIndicator>,
    private readonly biRateCollector: BiRateCollector,
    private readonly fredCollector: FredCollector,
    private readonly idxPriceCollector: IdxPriceCollector,
  ) {}

  async collectBiRate(): Promise<void> {
    const payloads = await this.biRateCollector.collect();
    await this.upsertMacro(payloads, this.biRateCollector.source);
    this.logger.log(`BiRate: upserted ${payloads.length} record(s)`);
  }

  async collectFred(): Promise<void> {
    const payloads = await this.fredCollector.collect();
    await this.upsertMacro(payloads, this.fredCollector.source);
    this.logger.log(`Fred: upserted ${payloads.length} record(s)`);
  }

  async collectIdxPrices(): Promise<void> {
    const payloads = await this.idxPriceCollector.collect();
    await this.upsertStock(payloads, this.idxPriceCollector.source);
    this.logger.log(`IdxPrice: upserted ${payloads.length} record(s)`);
  }

  private async upsertMacro(payloads: IndicatorPayload[], source: string): Promise<void> {
    for (const p of payloads) {
      const existing = await this.macroRepo.findOne({
        where: { code: p.code, periodDate: p.periodDate },
      });
      if (existing) {
        await this.macroRepo.update(existing.id, { value: p.value, unit: p.unit });
      } else {
        await this.macroRepo.save({ code: p.code, value: p.value, unit: p.unit, source, periodDate: p.periodDate });
      }
    }
  }

  private async upsertStock(payloads: IndicatorPayload[], source: string): Promise<void> {
    for (const p of payloads) {
      const ticker = p.code.replace('PRICE_', '');
      const existing = await this.stockRepo.findOne({
        where: { ticker, code: p.code, periodDate: p.periodDate },
      });
      if (existing) {
        await this.stockRepo.update(existing.id, { value: p.value, unit: p.unit });
      } else {
        await this.stockRepo.save({ ticker, code: p.code, value: p.value, unit: p.unit, source, periodDate: p.periodDate });
      }
    }
  }
}
