import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MacroIndicator } from '../../database/entities/macro-indicator.entity';
import { SectoralIndicator } from '../../database/entities/sectoral-indicator.entity';
import { StockIndicator } from '../../database/entities/stock-indicator.entity';
import { IndicatorService } from './indicator.service';

@Module({
  imports: [TypeOrmModule.forFeature([MacroIndicator, SectoralIndicator, StockIndicator])],
  providers: [IndicatorService],
  exports: [IndicatorService],
})
export class IndicatorModule {}
