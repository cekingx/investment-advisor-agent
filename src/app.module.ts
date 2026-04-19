import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TelegramModule } from './modules/telegram/telegram.module';
import { CollectorModule } from './modules/collector/collector.module';
import { User } from './database/entities/user.entity';
import { MacroIndicator } from './database/entities/macro-indicator.entity';
import { StockIndicator } from './database/entities/stock-indicator.entity';

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
        entities: [User, MacroIndicator, StockIndicator],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    TelegramModule,
    CollectorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
