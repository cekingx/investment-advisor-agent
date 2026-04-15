import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import type { Update } from 'telegraf/types';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Body() update: Update) {
    await this.telegramService.bot.handleUpdate(update);
  }
}
