import { Injectable, Logger } from '@nestjs/common';
import { TelegramService } from '../../modules/telegram/telegram.service';

@Injectable()
export class SendActivity {
  private readonly logger = new Logger(SendActivity.name);

  constructor(private readonly telegramService: TelegramService) {}

  async sendTelegramMessage(chatId: number, text: string): Promise<void> {
    this.logger.log(`Activity: sendTelegramMessage chatId=${chatId}`);
    await this.telegramService.sendMessage(chatId, text);
  }

  async sendErrorNotification(chatId: number, error: string): Promise<void> {
    this.logger.warn(`Activity: sendErrorNotification chatId=${chatId} error=${error}`);
    try {
      await this.telegramService.sendErrorNotification(chatId);
    } catch (e) {
      // swallow — secondary failure must not propagate
      this.logger.error(`sendErrorNotification failed silently: ${e}`);
    }
  }
}
