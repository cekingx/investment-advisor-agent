import { Injectable } from '@nestjs/common';
import { IndicatorSnapshot } from '../../temporal/temporal.types';

@Injectable()
export class AIService {
  async analyzeStock(_ticker: string, _snapshot: IndicatorSnapshot): Promise<string> {
    // Stub — full implementation in Task 3
    throw new Error('AIService.analyzeStock not yet implemented');
  }

  async generateWeeklySummary(_analyses: string[]): Promise<string> {
    // Stub — full implementation in Task 3
    throw new Error('AIService.generateWeeklySummary not yet implemented');
  }
}
