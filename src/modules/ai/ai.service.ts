import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IndicatorSnapshot, IndicatorRecord, StockIndicatorRecord, SectoralIndicatorRecord } from '../../temporal/temporal.types';

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(private readonly config: ConfigService) {}

  async analyzeStock(ticker: string, snapshot: IndicatorSnapshot): Promise<string> {
    const modelId = this.config.getOrThrow<string>('MODEL_FAST');
    const baseURL = this.config.getOrThrow<string>('LLM_BASE_URL');
    const apiKey = this.config.getOrThrow<string>('LLM_API_KEY');

    this.logger.log(`Analyzing ${ticker} with model ${modelId}`);

    const system = `You are a concise Indonesian investment analyst specializing in the IDX (Indonesia Stock Exchange).
Your job is to write a brief daily digest for a single stock ticker.

Rules:
- Output ONLY the final digest. Do NOT include reasoning, thinking, planning, or meta-commentary.
- Use Telegram-compatible markdown only: *bold*, _italic_, \`code\`.
- Do NOT use HTML tags.
- Keep the digest under 250 words.
- Structure:
  1. *Macro Snapshot* — 1-2 sentences on BI Rate and IDR/USD.
  2. *Stock Data* — latest price and any available sectoral context.
  3. *Quick Take* — a one-sentence outlook or risk note.
- Write in English with Indonesian financial terms where natural (e.g., "suku bunga", "rupiah").`;

    const userPrompt = this.buildDailyPrompt(ticker, snapshot);
    const text = await this.callChatCompletions(baseURL, apiKey, modelId, system, userPrompt, 0.4, 4096);

    return text.trim();
  }

  async generateWeeklySummary(analyses: string[]): Promise<string> {
    if (analyses.length === 0) {
      throw new Error('No daily analyses provided for weekly summary');
    }

    const modelId = this.config.getOrThrow<string>('MODEL_SMART');
    const baseURL = this.config.getOrThrow<string>('LLM_BASE_URL');
    const apiKey = this.config.getOrThrow<string>('LLM_API_KEY');

    this.logger.log(`Generating weekly summary with model ${modelId} from ${analyses.length} daily analyses`);

    const system = `You are a senior Indonesian investment strategist. Synthesize the week's daily stock analyses into a single cohesive top-down narrative.

Rules:
- Output ONLY the final digest. Do NOT include reasoning, thinking, planning, or meta-commentary.
- Use Telegram-compatible markdown only: *bold*, _italic_, \`code\`.
- Do NOT use HTML tags.
- Keep under 400 words.
- Structure:
  1. *Macro Environment* — interest-rate and currency trends.
  2. *Sectoral Context* — banking and retail/tech dynamics.
  3. *BBCA Implications* — price action, outlook, signal.
  4. *ERAA Implications* — price action, outlook, signal.
  5. *Week Ahead* — 1-2 sentence tactical view.
- Write in English with natural Indonesian financial terms.`;

    const userPrompt = `Here are the daily analyses for BBCA and ERAA from this week. Produce a unified weekly digest.

${analyses.map((a, i) => `--- Day ${i + 1} ---\n${a}`).join('\n\n')}`;

    const text = await this.callChatCompletions(baseURL, apiKey, modelId, system, userPrompt, 0.5, 8192);

    return text.trim();
  }

  private async callChatCompletions(
    baseURL: string,
    apiKey: string,
    model: string,
    system: string,
    prompt: string,
    temperature: number,
    maxTokens: number,
  ): Promise<string> {
    const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => 'unknown');
      throw new Error(`LLM API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('LLM API returned empty or malformed response');
    }

    return data.choices[0].message.content;
  }

  private buildDailyPrompt(ticker: string, snapshot: IndicatorSnapshot): string {
    const macroLines = snapshot.macro.map((m: IndicatorRecord) =>
      `- ${m.code}: ${m.value}${m.unit ? ' ' + m.unit : ''} (as of ${m.periodDate})`,
    );

    const sectoralLines = snapshot.sectoral.map((s: SectoralIndicatorRecord) =>
      `- ${s.sector} / ${s.code}: ${s.value}${s.unit ? ' ' + s.unit : ''} (as of ${s.periodDate})`,
    );

    const stockLines = snapshot.stock
      .filter((s: StockIndicatorRecord) => s.ticker === ticker)
      .map((s: StockIndicatorRecord) =>
        `- ${s.code}: ${s.value}${s.unit ? ' ' + s.unit : ''} (as of ${s.periodDate})`,
      );

    return `Ticker: ${ticker}

*Macro Indicators*
${macroLines.length ? macroLines.join('\n') : 'No macro data available.'}

*Sectoral Indicators*
${sectoralLines.length ? sectoralLines.join('\n') : 'No sectoral data available.'}

*Stock Indicators for ${ticker}*
${stockLines.length ? stockLines.join('\n') : 'No stock-specific data available.'}

Please write the daily digest for *${ticker}* now.`;
  }
}
