import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemporalService } from './temporal.service';
import { TemporalWorkerService } from './temporal-worker.service';
import { TemporalController } from './temporal.controller';
import { CollectActivity } from './activities/collect.activity';
import { AnalyzeActivity } from './activities/analyze.activity';
import { SendActivity } from './activities/send.activity';
import { CollectorModule } from '../modules/collector/collector.module';
import { IndicatorModule } from '../modules/indicator/indicator.module';
import { AIModule } from '../modules/ai/ai.module';
import { TelegramModule } from '../modules/telegram/telegram.module';
import { User } from '../database/entities/user.entity';
import { Analysis } from '../database/entities/analysis.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Analysis]),
    CollectorModule,
    IndicatorModule,
    AIModule,
    TelegramModule,
  ],
  controllers: [TemporalController],
  providers: [TemporalService, TemporalWorkerService, CollectActivity, AnalyzeActivity, SendActivity],
  exports: [TemporalService],
})
export class TemporalModule {}
