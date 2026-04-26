import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NativeConnection, Worker } from '@temporalio/worker';
import { CollectActivity } from './activities/collect.activity';
import { AnalyzeActivity } from './activities/analyze.activity';
import { SendActivity } from './activities/send.activity';
import * as path from 'path';

@Injectable()
export class TemporalWorkerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TemporalWorkerService.name);
  private worker: Worker | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly collectActivity: CollectActivity,
    private readonly analyzeActivity: AnalyzeActivity,
    private readonly sendActivity: SendActivity,
  ) {}

  async onApplicationBootstrap() {
    const address = this.config.get<string>('TEMPORAL_ADDRESS', 'localhost:7233');
    const namespace = this.config.get<string>('TEMPORAL_NAMESPACE', 'default');
    const taskQueue = this.config.get<string>('TEMPORAL_TASK_QUEUE', 'investment-advisor');

    const connection = await NativeConnection.connect({ address });

    this.worker = await Worker.create({
      connection,
      namespace,
      taskQueue,
      workflowsPath: path.resolve(__dirname, './workflows'),
      activities: {
        collectBiRate: this.collectActivity.collectBiRate.bind(this.collectActivity),
        collectFred: this.collectActivity.collectFred.bind(this.collectActivity),
        collectIdxPrices: this.collectActivity.collectIdxPrices.bind(this.collectActivity),
        fetchSubscribedUsers: this.collectActivity.fetchSubscribedUsers.bind(this.collectActivity),
        fetchLatestIndicators: this.analyzeActivity.fetchLatestIndicators.bind(this.analyzeActivity),
        analyzeStocks: this.analyzeActivity.analyzeStocks.bind(this.analyzeActivity),
        sendTelegramMessage: this.sendActivity.sendTelegramMessage.bind(this.sendActivity),
        sendErrorNotification: this.sendActivity.sendErrorNotification.bind(this.sendActivity),
      },
    });

    this.logger.log(`Temporal Worker started on task queue: ${taskQueue}`);
    void this.worker.run().catch((err) => this.logger.error('Worker crashed', err));
  }

  async onApplicationShutdown() {
    this.worker?.shutdown();
    this.logger.log('Temporal Worker shut down');
  }
}
