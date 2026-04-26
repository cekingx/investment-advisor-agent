import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollectorService } from '../../modules/collector/collector.service';
import { User } from '../../database/entities/user.entity';

@Injectable()
export class CollectActivity {
  private readonly logger = new Logger(CollectActivity.name);

  constructor(
    private readonly collectorService: CollectorService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async collectBiRate(): Promise<void> {
    this.logger.log('Activity: collectBiRate');
    await this.collectorService.collectBiRate();
  }

  async collectFred(): Promise<void> {
    this.logger.log('Activity: collectFred');
    await this.collectorService.collectFred();
  }

  async collectIdxPrices(): Promise<void> {
    this.logger.log('Activity: collectIdxPrices');
    await this.collectorService.collectIdxPrices();
  }

  async fetchSubscribedUsers(): Promise<number[]> {
    this.logger.log('Activity: fetchSubscribedUsers');
    const users = await this.userRepo.find({ where: { subscribed: true } });
    return users.map((u) => u.chatId);
  }
}
