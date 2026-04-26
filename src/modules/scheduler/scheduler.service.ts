import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemporalService } from '../../temporal/temporal.service';
import { User } from '../../database/entities/user.entity';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly temporal: TemporalService,
    private readonly config: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private get taskQueue() {
    return this.config.get<string>('TEMPORAL_TASK_QUEUE', 'investment-advisor');
  }

  @Cron('0 7 * * 1-5', { timeZone: 'Asia/Jakarta' })
  async dailyCollectAndAnalyze() {
    this.logger.log('Cron: collectDailyWorkflow');
    await this.temporal.startWorkflow('collectDailyWorkflow', {
      workflowId: `collect-daily-${Date.now()}`,
      taskQueue: this.taskQueue,
    });
  }

  @Cron('0 8 * * 1', { timeZone: 'Asia/Jakarta' })
  async weeklyCollect() {
    this.logger.log('Cron: collectWeeklyWorkflow');
    await this.temporal.startWorkflow('collectWeeklyWorkflow', {
      workflowId: `collect-weekly-${Date.now()}`,
      taskQueue: this.taskQueue,
    });
  }

  @Cron('0 8 2 * *', { timeZone: 'Asia/Jakarta' })
  async monthlyCollect() {
    this.logger.log('Cron: collectMonthlyWorkflow');
    await this.temporal.startWorkflow('collectMonthlyWorkflow', {
      workflowId: `collect-monthly-${Date.now()}`,
      taskQueue: this.taskQueue,
    });
  }

  @Cron('0 8 * * 6', { timeZone: 'Asia/Jakarta' })
  async weeklyAnalysis() {
    this.logger.log('Cron: analyzeWeeklyWorkflow for each subscribed user');
    const users = await this.userRepo.find({ where: { subscribed: true } });
    await Promise.all(
      users.map((u) =>
        this.temporal.startWorkflow('analyzeWeeklyWorkflow', {
          workflowId: `analyze-weekly-${u.chatId}-${Date.now()}`,
          taskQueue: this.taskQueue,
          args: [u.chatId],
        }),
      ),
    );
  }
}
