import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TelegramModule } from './modules/telegram/telegram.module';
import { CollectorModule } from './modules/collector/collector.module';
import { IndicatorModule } from './modules/indicator/indicator.module';
import { AIModule } from './modules/ai/ai.module';
import { TemporalModule } from './temporal/temporal.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { User } from './database/entities/user.entity';
import { MacroIndicator } from './database/entities/macro-indicator.entity';
import { SectoralIndicator } from './database/entities/sectoral-indicator.entity';
import { StockIndicator } from './database/entities/stock-indicator.entity';
import { Analysis } from './database/entities/analysis.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASS'),
        database: config.getOrThrow<string>('DB_NAME'),
        entities: [User, MacroIndicator, SectoralIndicator, StockIndicator, Analysis],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    ScheduleModule.forRoot(),
    TelegramModule,
    CollectorModule,
    IndicatorModule,
    AIModule,
    TemporalModule,
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
