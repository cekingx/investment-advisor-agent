import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndicatorService } from '../../modules/indicator/indicator.service';
import { AIService } from '../../modules/ai/ai.service';
import { Analysis } from '../../database/entities/analysis.entity';
import { User } from '../../database/entities/user.entity';
import { IndicatorSnapshot } from '../temporal.types';

const TICKERS = ['BBCA', 'ERAA'];

@Injectable()
export class AnalyzeActivity {
  private readonly logger = new Logger(AnalyzeActivity.name);

  constructor(
    private readonly indicatorService: IndicatorService,
    private readonly aiService: AIService,
    @InjectRepository(Analysis)
    private readonly analysisRepo: Repository<Analysis>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async fetchLatestIndicators(): Promise<IndicatorSnapshot> {
    this.logger.log('Activity: fetchLatestIndicators');
    return this.indicatorService.getLatestSnapshot();
  }

  async analyzeStocks(chatId: number, snapshot: IndicatorSnapshot): Promise<string> {
    this.logger.log(`Activity: analyzeStocks for chatId=${chatId}`);

    const user = await this.userRepo.findOne({ where: { chatId } });

    const analyses: string[] = [];
    for (const ticker of TICKERS) {
      const text = await this.aiService.analyzeStock(ticker, snapshot);
      analyses.push(text);

      if (user) {
        await this.analysisRepo.save({
          user,
          type: 'daily',
          content: text,
        });
      }
    }

    return analyses.join('\n\n---\n\n');
  }
}
