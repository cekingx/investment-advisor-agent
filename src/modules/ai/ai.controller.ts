import { Controller, Get, Param, ParseEnumPipe } from '@nestjs/common';
import { AIService } from './ai.service';
import { IndicatorService } from '../indicator/indicator.service';

enum Ticker {
  BBCA = 'BBCA',
  ERAA = 'ERAA',
}

@Controller('ai')
export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly indicatorService: IndicatorService,
  ) {}

  @Get('analyze/:ticker')
  async analyzeStock(@Param('ticker', new ParseEnumPipe(Ticker)) ticker: string) {
    const snapshot = await this.indicatorService.getLatestSnapshot();
    const result = await this.aiService.analyzeStock(ticker, snapshot);

    return {
      data: result
    }
  }
}
