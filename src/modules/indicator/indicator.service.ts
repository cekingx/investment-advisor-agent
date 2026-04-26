import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MacroIndicator } from '../../database/entities/macro-indicator.entity';
import { SectoralIndicator } from '../../database/entities/sectoral-indicator.entity';
import { StockIndicator } from '../../database/entities/stock-indicator.entity';
import { IndicatorSnapshot } from '../../temporal/temporal.types';

@Injectable()
export class IndicatorService {
  constructor(
    @InjectRepository(MacroIndicator)
    private readonly macroRepo: Repository<MacroIndicator>,
    @InjectRepository(SectoralIndicator)
    private readonly sectoralRepo: Repository<SectoralIndicator>,
    @InjectRepository(StockIndicator)
    private readonly stockRepo: Repository<StockIndicator>,
  ) {}

  async getLatestSnapshot(): Promise<IndicatorSnapshot> {
    const [macro, sectoral, stock] = await Promise.all([
      this.getLatestMacro(),
      this.getLatestSectoral(),
      this.getLatestStock(),
    ]);
    return { macro, sectoral, stock };
  }

  private async getLatestMacro() {
    const rows = await this.macroRepo
      .createQueryBuilder('m')
      .distinctOn(['m.code'])
      .orderBy('m.code')
      .addOrderBy('m.periodDate', 'DESC')
      .getMany();

    return rows.map((r) => ({
      code: r.code,
      value: Number(r.value),
      unit: r.unit ?? null,
      periodDate: r.periodDate instanceof Date ? r.periodDate.toISOString() : String(r.periodDate),
    }));
  }

  private async getLatestSectoral() {
    const rows = await this.sectoralRepo
      .createQueryBuilder('s')
      .distinctOn(['s.sector', 's.code'])
      .orderBy('s.sector')
      .addOrderBy('s.code')
      .addOrderBy('s.periodDate', 'DESC')
      .getMany();

    return rows.map((r) => ({
      sector: r.sector,
      code: r.code,
      value: Number(r.value),
      unit: r.unit ?? null,
      periodDate: r.periodDate instanceof Date ? r.periodDate.toISOString() : String(r.periodDate),
    }));
  }

  private async getLatestStock() {
    const rows = await this.stockRepo
      .createQueryBuilder('s')
      .distinctOn(['s.ticker', 's.code'])
      .orderBy('s.ticker')
      .addOrderBy('s.code')
      .addOrderBy('s.periodDate', 'DESC')
      .getMany();

    return rows.map((r) => ({
      ticker: r.ticker,
      code: r.code,
      value: Number(r.value),
      unit: r.unit ?? null,
      periodDate: r.periodDate instanceof Date ? r.periodDate.toISOString() : String(r.periodDate),
    }));
  }
}
