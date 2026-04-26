import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, WorkflowClient } from '@temporalio/client';

@Injectable()
export class TemporalService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TemporalService.name);
  private connection: Connection;
  client: WorkflowClient;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.connection = await Connection.connect({
      address: this.config.get<string>('TEMPORAL_ADDRESS', 'localhost:7233'),
    });
    this.client = new WorkflowClient({
      connection: this.connection,
      namespace: this.config.get<string>('TEMPORAL_NAMESPACE', 'default'),
    });
    this.logger.log('Temporal WorkflowClient connected');
  }

  async onModuleDestroy() {
    await this.connection?.close();
  }

  async startWorkflow(
    workflowType: string,
    options: { workflowId: string; taskQueue: string; args?: unknown[] },
  ) {
    return this.client.start(workflowType, {
      workflowId: options.workflowId,
      taskQueue: options.taskQueue,
      args: options.args ?? [],
    });
  }
}
