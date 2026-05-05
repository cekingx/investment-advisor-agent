import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';

@Injectable()
export class NotificationService {
  private readonly bot: Telegraf;

  constructor(config: ConfigService) {
    this.bot = new Telegraf(config.getOrThrow<string>('TELEGRAM_BOT_TOKEN'));
  }

  async sendMessage(chatId: number, text: string): Promise<void> {
    await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  }

  async sendErrorNotification(chatId: number, error?: string): Promise<void> {
    const message = error
      ? `⚠️ Analysis failed: ${error}. Will retry at the next scheduled run.`
      : '⚠️ Analysis failed. Will retry at the next scheduled run.';
    await this.bot.telegram.sendMessage(chatId, message);
  }
}
