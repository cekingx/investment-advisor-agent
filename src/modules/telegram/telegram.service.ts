import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Telegraf, Context } from 'telegraf';
import { User } from '../../database/entities/user.entity';
import { TemporalService } from '../../temporal/temporal.service';
import { IndicatorService } from '../indicator/indicator.service';
import { IndicatorSnapshot } from '../../temporal/temporal.types';

@Injectable()
export class TelegramService implements OnModuleInit {
  readonly bot: Telegraf;
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly temporal: TemporalService,
    private readonly indicatorService: IndicatorService,
  ) {
    this.bot = new Telegraf(this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN'));
  }

  async onModuleInit() {
    this.bot.command('start', (ctx) => this.onStart(ctx));
    this.bot.command('stop', (ctx) => this.onStop(ctx));
    this.bot.command('help', (ctx) => this.onHelp(ctx));
    this.bot.command('analyze', (ctx) => this.onAnalyze(ctx));
    this.bot.command('latest', (ctx) => this.onLatest(ctx));

    const webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL');
    if (webhookUrl) {
      try {
        await this.bot.telegram.setWebhook(webhookUrl);
        this.logger.log(`Telegram webhook set to ${webhookUrl}`);
      } catch (err) {
        this.logger.error(`Failed to set Telegram webhook: ${err}`);
      }
    }
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

  async onAnalyze(ctx: Context) {
    const chatId = ctx.chat!.id;
    await ctx.reply('🔍 Fetching latest analysis… This may take a moment.');

    const workflowId = `analyze-ondemand-${chatId}-${Date.now()}`;
    const taskQueue = this.config.get<string>('TEMPORAL_TASK_QUEUE', 'investment-advisor');

    this.temporal
      .startWorkflow('onDemandAnalysisWorkflow', {
        workflowId,
        taskQueue,
        args: [chatId],
      })
      .catch((err) => {
        this.logger.error(`Failed to start on-demand workflow for chatId=${chatId}: ${err}`);
      });
  }

  async onLatest(ctx: Context) {
    const snapshot = await this.indicatorService.getLatestSnapshot();
    const text = this.formatSnapshot(snapshot);
    await ctx.reply(text, { parse_mode: 'Markdown' });
  }

  private formatSnapshot(snapshot: IndicatorSnapshot): string {
    const hasAny =
      snapshot.macro.length > 0 ||
      snapshot.sectoral.length > 0 ||
      snapshot.stock.length > 0;

    if (!hasAny) {
      return '📭 No indicators have been collected yet. Please check back after the next scheduled run (07:00 WIB on trading days).';
    }

    let text = '📊 *Latest Indicators*\n\n';

    if (snapshot.macro.length > 0) {
      text += '*Macro*\n';
      for (const item of snapshot.macro) {
        text += `• \`${item.code}\`: ${item.value}${item.unit ? ' ' + item.unit : ''} (_${item.periodDate.split('T')[0]}_)\n`;
      }
      text += '\n';
    }

    if (snapshot.sectoral.length > 0) {
      text += '*Sectoral*\n';
      for (const item of snapshot.sectoral) {
        text += `• \`${item.code}\` (${item.sector}): ${item.value}${item.unit ? ' ' + item.unit : ''} (_${item.periodDate.split('T')[0]}_)\n`;
      }
      text += '\n';
    }

    if (snapshot.stock.length > 0) {
      text += '*Stock*\n';
      for (const item of snapshot.stock) {
        text += `• \`${item.code}\` (${item.ticker}): ${item.value}${item.unit ? ' ' + item.unit : ''} (_${item.periodDate.split('T')[0]}_)\n`;
      }
    }

    return text;
  }
}
