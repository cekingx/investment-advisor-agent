import { Controller, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TemporalService } from './temporal.service';

@Controller('debug')
export class TemporalController {
  constructor(
    private readonly temporal: TemporalService,
    private readonly config: ConfigService,
  ) {}

  private get taskQueue() {
    return this.config.get<string>('TEMPORAL_TASK_QUEUE', 'investment-advisor');
  }

  @Post('collect-daily')
  async triggerCollectDaily() {
    const workflowId = `collect-daily-debug-${Date.now()}`;
    await this.temporal.startWorkflow('collectDailyWorkflow', {
      workflowId,
      taskQueue: this.taskQueue,
    });
    return { workflowId };
  }

  @Post('analyze/:chatId')
  async triggerAnalyze(@Param('chatId') chatId: string) {
    const workflowId = `analyze-daily-debug-${chatId}-${Date.now()}`;
    await this.temporal.startWorkflow('onDemandAnalysisWorkflow', {
      workflowId,
      taskQueue: this.taskQueue,
      args: [Number(chatId)],
    });
    return { workflowId };
  }
}
