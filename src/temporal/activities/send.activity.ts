import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from '../../modules/notification/notification.service';

@Injectable()
export class SendActivity {
  private readonly logger = new Logger(SendActivity.name);

  constructor(private readonly notificationService: NotificationService) {}

  async sendTelegramMessage(chatId: number, text: string): Promise<void> {
    this.logger.log(`Activity: sendTelegramMessage chatId=${chatId}`);
    await this.notificationService.sendMessage(chatId, text);
  }

  async sendErrorNotification(chatId: number, error: string): Promise<void> {
    this.logger.warn(`Activity: sendErrorNotification chatId=${chatId} error=${error}`);
    try {
      await this.notificationService.sendErrorNotification(chatId, error);
    } catch (e) {
      // swallow — secondary failure must not propagate
      this.logger.error(`sendErrorNotification failed silently: ${e}`);
    }
  }
}
