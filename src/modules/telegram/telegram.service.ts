import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Telegraf, Context } from 'telegraf';
import { User } from '../../database/entities/user.entity';

@Injectable()
export class TelegramService implements OnModuleInit {
  readonly bot: Telegraf;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
    this.bot = new Telegraf(this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN'));
  }

  onModuleInit() {
    this.bot.command('start', (ctx) => this.onStart(ctx));
    this.bot.command('stop', (ctx) => this.onStop(ctx));
    this.bot.command('help', (ctx) => this.onHelp(ctx));
  }

  async onStart(ctx: Context) {
    const chatId = ctx.chat!.id;
    await this.userRepository.upsert(
      { chatId, subscribed: true },
      { conflictPaths: ['chatId'] },
    );
    await ctx.reply(
      '✅ You are now subscribed to Investment Advisor!\n\n' +
        'You will receive:\n' +
        '• Daily digest at 07:00 WIB on trading days (Mon–Fri)\n' +
        '• Weekly top-down analysis every Saturday at 08:00 WIB\n\n' +
        'Use /help to see all available commands.',
    );
  }

  async onStop(ctx: Context) {
    const chatId = ctx.chat!.id;
    await this.userRepository.upsert(
      { chatId, subscribed: false },
      { conflictPaths: ['chatId'] },
    );
    await ctx.reply(
      '⛔ Subscription deactivated. You will no longer receive digests.\n\n' +
        'Send /start to re-subscribe.',
    );
  }

  async onHelp(ctx: Context) {
    await ctx.reply(
      '📋 Available commands:\n\n' +
        '/start — Subscribe to investment digests\n' +
        '/stop — Deactivate your subscription\n' +
        '/analyze — Request an immediate analysis\n' +
        '/latest — Show latest raw indicator values\n' +
        '/help — Show this help message\n\n' +
        '📅 Delivery schedule:\n' +
        '• Daily digest: 07:00 WIB (Mon–Fri)\n' +
        '• Weekly digest: Saturday 08:00 WIB',
    );
  }

  async sendMessage(chatId: number, text: string) {
    await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  }

  async sendErrorNotification(chatId: number) {
    await this.bot.telegram.sendMessage(
      chatId,
      '⚠️ Analysis failed. Will retry at the next scheduled run.',
    );
  }
}
