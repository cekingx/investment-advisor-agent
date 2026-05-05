import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { TemporalModule } from '../../temporal/temporal.module';
import { IndicatorModule } from '../indicator/indicator.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    TemporalModule,
    IndicatorModule,
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
