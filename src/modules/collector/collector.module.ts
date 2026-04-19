import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MacroIndicator } from '../../database/entities/macro-indicator.entity';
import { StockIndicator } from '../../database/entities/stock-indicator.entity';
import { BiRateCollector } from './macro/bi-rate.collector';
import { FredCollector } from './macro/fred.collector';
import { IdxPriceCollector } from './stock/idx-price.collector';
import { CollectorService } from './collector.service';
import { CollectorController } from './collector.controller';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([MacroIndicator, StockIndicator])],
  controllers: [CollectorController],
  providers: [BiRateCollector, FredCollector, IdxPriceCollector, CollectorService],
  exports: [CollectorService],
})
export class CollectorModule {}
