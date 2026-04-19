# Technical Architecture
# Investment Advisor Agent

**Stack:** NestJS · TypeScript · Temporal · @ai-sdk/openai · PostgreSQL · Telegraf · Docker

---

## 1. Project Structure

```
src/
├── app.module.ts
├── config/
│   ├── app.config.ts
│   ├── database.config.ts
│   └── sources.config.ts          # URL & API key per data source
│
├── modules/
│   ├── scheduler/
│   │   ├── scheduler.module.ts
│   │   └── scheduler.service.ts   # @Cron() → triggers Temporal workflows
│   │
│   ├── collector/
│   │   ├── collector.module.ts
│   │   ├── macro/
│   │   │   ├── bi-rate.collector.ts        # BI Rate → bi.go.id
│   │   │   ├── ikk.collector.ts            # Consumer Confidence → bi.go.id
│   │   │   ├── bps.collector.ts            # GDP, CPI → bps.go.id
│   │   │   └── fred.collector.ts           # IDR/USD, global CPI → FRED API
│   │   ├── sectoral/
│   │   │   ├── banking/
│   │   │   │   └── ojk-spi.collector.ts    # NPL, NIM, CAR, Loan growth → OJK
│   │   │   └── retail-tech/
│   │   │       └── ipr.collector.ts        # Retail Sales Index → BPS
│   │   └── stock/
│   │       ├── idx-price.collector.ts      # Stock prices → IDX / Yahoo Finance
│   │       └── financial-report.collector.ts  # Financial reports → IDX
│   │
│   ├── indicator/
│   │   ├── indicator.module.ts
│   │   ├── indicator.controller.ts # REST API for querying stored indicators
│   │   └── indicator.service.ts
│   │
│   ├── ai/
│   │   ├── ai.module.ts
│   │   └── ai.service.ts           # LLM calls via @ai-sdk/openai
│   │
│   └── telegram/
│       ├── telegram.module.ts
│       └── telegram.service.ts     # Telegraf bot, commands, sendMessage
│
├── temporal/
│   ├── temporal.module.ts
│   ├── workflows/
│   │   ├── collect.workflow.ts     # Collection workflows (daily/weekly/monthly)
│   │   └── analyze.workflow.ts     # Analysis + delivery workflows
│   └── activities/
│       ├── collect.activity.ts     # Wraps each collector
│       ├── analyze.activity.ts     # Calls AIService
│       └── send.activity.ts        # Calls TelegramService
│
├── database/
│   ├── entities/
│   │   ├── user.entity.ts
│   │   ├── macro-indicator.entity.ts
│   │   ├── sectoral-indicator.entity.ts
│   │   └── stock-indicator.entity.ts
│   └── migrations/
│
└── common/
    └── utils/
        ├── retry.util.ts
        └── http.util.ts            # Axios wrapper with timeout & logging
```

---

## 2. Module Dependency Graph

```
AppModule
├── ConfigModule              (global, provides ConfigService)
├── TypeOrmModule             (global, provides DB connection)
├── SchedulerModule
│   └── imports: TemporalModule
│   └── provides: SchedulerService (@Cron triggers)
├── CollectorModule
│   └── provides: BiRateCollector, IkkCollector, BpsCollector, FredCollector,
│                 OjkSpiCollector, IprCollector, IdxPriceCollector, FinancialReportCollector
├── IndicatorModule
│   └── provides: IndicatorService, IndicatorController
├── AIModule
│   └── provides: AIService
├── TelegramModule
│   └── provides: TelegramService
└── TemporalModule            (nestjs-temporal-core)
    ├── imports: CollectorModule, AIModule, TelegramModule
    └── provides: CollectActivity, AnalyzeActivity, SendActivity
```

---

## 3. Domain Breakdown

### 3.1 Collector Domain

**Responsibility:** Fetch indicator data from external sources and persist to PostgreSQL.

Every collector implements `ICollector`:

```typescript
interface ICollector {
  readonly indicatorCode: string   // e.g. 'BI_RATE', 'NPL_BANKING'
  readonly layer: 'macro' | 'sectoral' | 'stock'
  readonly source: string          // e.g. 'bi.go.id', 'FRED', 'OJK'
  collect(): Promise<IndicatorPayload[]>
}

interface IndicatorPayload {
  code: string
  value: number
  unit: string
  periodDate: Date
}
```

**Collector mapping:**

| Collector | Indicators | Layer | Relevant for |
|---|---|---|---|
| `bi-rate.collector` | BI_RATE | Macro | BBCA, ERAA |
| `ikk.collector` | IKK | Macro | ERAA |
| `fred.collector` | IDR_USD, CPI_GLOBAL | Macro | BBCA, ERAA |
| `bps.collector` | GDP_GROWTH, CPI_ID, HOUSEHOLD_CONSUMPTION | Macro | BBCA, ERAA |
| `ojk-spi.collector` | NPL_BANKING, NIM_BANKING, CAR_BANKING, LOAN_GROWTH | Sectoral | BBCA |
| `ipr.collector` | IPR_RETAIL, RETAIL_SALES_GROWTH | Sectoral | ERAA |
| `idx-price.collector` | PRICE_BBCA, PRICE_ERAA | Stock | BBCA, ERAA |
| `financial-report.collector` | CASA_BBCA, NPL_BBCA, SSSG_ERAA, DAYS_INV_ERAA, etc. | Stock | BBCA, ERAA |

---

### 3.2 Indicator Domain

**Responsibility:** Provide a REST API to read stored indicator data.

```
GET /indicators/macro
    ?code=BI_RATE
    &from=2025-01-01
    &to=2026-04-13

GET /indicators/sectoral
    ?sector=banking
    &code=NPL_BANKING

GET /indicators/stock
    ?ticker=BBCA
    &code=CASA_BBCA

GET /indicators/latest
    # All indicators, latest value only
```

---

### 3.3 AI Domain

**Responsibility:** Read latest indicators from PostgreSQL and generate investment analysis via Anthropic Claude.

**AIService**
- `analyzeStock(ticker, indicators)` — reads macro + sectoral + stock indicators, returns structured top-down analysis in Telegram-formatted markdown
- `generateWeeklySummary(analyses[])` — synthesizes the week's daily analyses into a narrative weekly review

**Model selection:**

| Analysis type | Env var | Reason |
|---|---|---|
| Daily stock analysis | `MODEL_FAST` | Fast, cheap, sufficient for structured indicator analysis |
| Weekly review | `MODEL_SMART` | More capable for narrative synthesis and trend reasoning |

Model IDs follow the provider's OpenAI-compatible format (e.g. `anthropic/claude-haiku-4-5` on OpenRouter).

**Cost optimization rules:**
- All indicators for a ticker batched into a single `generateText()` call
- Weekly review reads stored daily analyses from DB — never re-fetches raw indicators
- Indicator count per call capped at what fits a structured prompt (configurable via env)

---

### 3.4 Telegram Domain

**Responsibility:** Handle inbound bot commands, push outbound analysis messages.

**TelegramService**
- `onStart(ctx)` — registers user chat ID in PostgreSQL
- `onStop(ctx)` — deactivates user subscription
- `onAnalyze(ctx)` — triggers on-demand analysis workflow for that user
- `onLatest(ctx)` — replies with latest indicator values from DB (no AI call)
- `onHelp(ctx)` — replies with command list and schedule info
- `sendMessage(chatId, text)` — pushes message to user (called from SendActivity)
- `sendErrorNotification(chatId, error)` — called when all Temporal retries exhausted

**User entity (TypeORM)**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `chat_id` | bigint | Telegram chat ID, unique |
| `subscribed` | boolean | default true |
| `created_at` | timestamptz | |

**Bot commands:**

| Command | Handler | Behavior |
|---|---|---|
| `/start` | `onStart` | Register user, confirm subscription |
| `/stop` | `onStop` | Deactivate, stop receiving analyses |
| `/analyze` | `onAnalyze` | Trigger immediate analysis via Temporal |
| `/latest` | `onLatest` | Show latest raw indicator values |
| `/help` | `onHelp` | Show schedule and command list |

**Webhook setup:**
- Telegraf configured in webhook mode (not polling)
- NestJS exposes `POST /telegram/webhook`
- HTTPS handled by Caddy reverse proxy

---

### 3.5 Temporal Domain

**Responsibility:** Durable orchestration of the collect → analyze → send pipeline.

Workflows are pure TypeScript functions. No NestJS imports, no direct API calls — only activity calls via `proxyActivities()`.

#### Collection Workflows

**`collectDailyWorkflow()`**
```
1. collectBiRate()         → BI_RATE
2. collectFred()           → IDR_USD
3. collectIdxPrices()      → PRICE_BBCA, PRICE_ERAA
4. startChild(analyzeDailyWorkflow, { args: [chatId] }) per subscribed user
```

**`collectWeeklyWorkflow()`**
```
1. collectOjkSpi()         → NPL_BANKING, NIM_BANKING, CAR_BANKING, LOAN_GROWTH
2. collectIpr()            → IPR_RETAIL, RETAIL_SALES_GROWTH
```

**`collectMonthlyWorkflow()`**
```
1. collectIkk()            → IKK
2. collectBps()            → GDP_GROWTH, CPI_ID, HOUSEHOLD_CONSUMPTION
3. collectFinancialReports() → CASA_BBCA, NPL_BBCA, SSSG_ERAA, DAYS_INV_ERAA, etc.
```

#### Analysis Workflows

**`analyzeDailyWorkflow(chatId: number)`**
```
1. fetchLatestIndicators()   → reads all latest values from PostgreSQL
2. analyzeStocks()           → AIService.analyzeStock() for BBCA & ERAA
3. sendTelegramMessage()     → delivers formatted analysis to user
```

**`analyzeWeeklyWorkflow(chatId: number)`**
```
1. fetchStoredAnalyses({ since: startOfWeek })  → reads all available daily analyses from the current week (Mon–Fri)
2. generateWeeklySummary()                      → AIService.generateWeeklySummary()
3. sendTelegramMessage()                        → delivers narrative weekly review
```
Analysis uses however many daily analyses exist for that week — accounts for public holidays or collection failures without blocking delivery.

**`onDemandAnalysisWorkflow(chatId: number)`**
```
Same as analyzeDailyWorkflow — triggered immediately on /analyze command.
Workflow ID includes chatId + timestamp to prevent duplicates.
```

#### Activities

**CollectActivity** (wraps each collector)
- `collectBiRate()`, `collectFred()`, `collectIdxPrices()`, `collectOjkSpi()`, `collectIpr()`, `collectIkk()`, `collectBps()`, `collectFinancialReports()`
- Timeout: 3 minutes per collector
- Retries: 3, backoff: 10s → 30s → 90s

**AnalyzeActivity**
- `fetchLatestIndicators()` — reads from PostgreSQL
- `analyzeStocks(indicators)` — calls AIService
- `generateWeeklySummary(analyses[])` — calls AIService
- Timeout: 5 minutes (LLM calls can be slow)
- Retries: 3, initial interval: 10s

**SendActivity**
- `sendTelegramMessage({ chatId, text })` — calls TelegramService
- `sendErrorNotification({ chatId, error })` — called in workflow catch block
- Timeout: 1 minute
- Retries: 5, backoff: 5s intervals

#### Activity retry policies

```
CollectActivity:
  startToCloseTimeout: 3 minutes
  retryPolicy:
    maximumAttempts: 3
    initialInterval: 10s
    backoffCoefficient: 2

AnalyzeActivity:
  startToCloseTimeout: 5 minutes
  retryPolicy:
    maximumAttempts: 3
    initialInterval: 10s
    backoffCoefficient: 2

SendActivity:
  startToCloseTimeout: 1 minute
  retryPolicy:
    maximumAttempts: 5
    initialInterval: 5s
    backoffCoefficient: 1.5
```

---

### 3.6 Scheduler Domain

**Responsibility:** Trigger Temporal workflows on a cron schedule.

**SchedulerService**

| Cron | Expression | Workflows triggered |
|---|---|---|
| Daily collection + analysis | `0 7 * * 1-5` | `collectDailyWorkflow` (spawns `analyzeDailyWorkflow` as child per subscribed user after collection completes) |
| Weekly collection | `0 8 * * 1` | `collectWeeklyWorkflow` |
| Weekly analysis | `0 8 * * 6` | `analyzeWeeklyWorkflow` for each subscribed user |
| Monthly collection | `0 8 2 * *` | `collectMonthlyWorkflow` |

The scheduler triggers only `collectDailyWorkflow`. After all collection activities complete, the workflow spawns `analyzeDailyWorkflow` as a child workflow for each subscribed user via `startChild()`. This guarantees all indicators are persisted before any analysis reads from the DB.

---

## 4. Data Flow

### Daily collection + analysis (07:00 WIB)

```
SchedulerService @Cron("0 7 * * 1-5")
  → TemporalClient.start(collectDailyWorkflow)

collectDailyWorkflow
  → CollectActivity.collectBiRate()
        GET bi.go.id → parse HTML
        → MacroIndicatorRepository.upsert({ code:'BI_RATE', ... })
  → CollectActivity.collectFred(['IDR_USD'])
        GET api.stlouisfed.org → parse JSON
        → MacroIndicatorRepository.upsert({ code:'IDR_USD', ... })
  → CollectActivity.collectIdxPrices(['BBCA','ERAA'])
        GET Yahoo Finance / IDX → parse JSON
        → StockIndicatorRepository.upsert({ ticker:'BBCA', code:'PRICE_BBCA', ... })
  → startChild(analyzeDailyWorkflow, { args: [chatId] }) per subscribed user   ← collection done, safe to read DB

analyzeDailyWorkflow(chatId)
  → AnalyzeActivity.fetchLatestIndicators()
        IndicatorRepository.getLatest(['BI_RATE','IDR_USD','PRICE_BBCA',...])
        → returns IndicatorSnapshot
  → AnalyzeActivity.analyzeStocks(snapshot)
        AIService.analyzeStock('BBCA', macroIndicators, sectoralIndicators, stockIndicators)
          generateText(MODEL_FAST, system prompt, indicators)   [OpenAI-compatible API]
          return formatted markdown analysis
  → SendActivity.sendTelegramMessage({ chatId, text })
        TelegramService.sendMessage(chatId, text)                [Telegram API]
        AnalysisRepository.saveAnalysis(userId, text, 'daily')   [PostgreSQL]
```

### Weekly analysis (Saturday 08:00 WIB)

```
SchedulerService @Cron("0 8 * * 6")
  → TemporalClient.start(analyzeWeeklyWorkflow, { args: [chatId] }) per subscribed user

analyzeWeeklyWorkflow(chatId)
  → AnalyzeActivity.fetchStoredAnalyses({ since: startOfWeek })
        AnalysisRepository.getDailyAnalyses(Mon–Fri of current week)    [PostgreSQL]
        → string[]  ← whatever analyses exist; 1–5 entries depending on trading days and failures
  → AnalyzeActivity.generateWeeklySummary(analyses)
        AIService.generateWeeklySummary(analyses)
          generateText(MODEL_SMART, weekly prompt, analyses)   [OpenAI-compatible API]
          return narrative markdown
  → SendActivity.sendTelegramMessage({ chatId, text })
        TelegramService.sendMessage(chatId, text)               [Telegram API]
        AnalysisRepository.saveAnalysis(userId, text, 'weekly') [PostgreSQL]
```

### On-demand analysis (/analyze command)

```
User sends /analyze
  → Telegram webhook → POST /telegram/webhook
  → TelegramService.onAnalyze(ctx)
      ctx.reply("Fetching latest analysis...")
      TemporalClient.start(onDemandAnalysisWorkflow, {
        workflowId: `analyze-${chatId}-${Date.now()}`,
        args: [chatId]
      })

onDemandAnalysisWorkflow → same as analyzeDailyWorkflow
```

### Failure path

```
Any activity exhausts all retries
  → Temporal marks workflow as failed
  → Workflow catch block runs
  → SendActivity.sendErrorNotification({ chatId, error })
      → user receives: "⚠️ Analysis failed. Will retry at the next scheduled run."
```

---

## 5. Database Schema

```sql
-- Users
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    BIGINT UNIQUE NOT NULL,
  subscribed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Macro indicators (time-series)
CREATE TABLE macro_indicators (
  id           SERIAL PRIMARY KEY,
  code         VARCHAR(50)   NOT NULL,   -- 'BI_RATE', 'GDP_GROWTH', 'IDR_USD'
  value        NUMERIC(18,4) NOT NULL,
  unit         VARCHAR(20),              -- '%', 'IDR', 'index'
  source       VARCHAR(50)   NOT NULL,
  period_date  DATE          NOT NULL,
  fetched_at   TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (code, period_date)
);

-- Sectoral indicators (time-series)
CREATE TABLE sectoral_indicators (
  id           SERIAL PRIMARY KEY,
  sector       VARCHAR(50)   NOT NULL,   -- 'banking', 'retail_tech'
  code         VARCHAR(50)   NOT NULL,   -- 'NPL_BANKING', 'LOAN_GROWTH'
  value        NUMERIC(18,4) NOT NULL,
  unit         VARCHAR(20),
  source       VARCHAR(50)   NOT NULL,
  period_date  DATE          NOT NULL,
  fetched_at   TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (sector, code, period_date)
);

-- Stock indicators (time-series)
CREATE TABLE stock_indicators (
  id           SERIAL PRIMARY KEY,
  ticker       VARCHAR(10)   NOT NULL,   -- 'BBCA', 'ERAA'
  code         VARCHAR(50)   NOT NULL,   -- 'CASA_BBCA', 'SSSG_ERAA'
  value        NUMERIC(18,4) NOT NULL,
  unit         VARCHAR(20),
  source       VARCHAR(50)   NOT NULL,
  period_date  DATE          NOT NULL,
  fetched_at   TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (ticker, code, period_date)
);

-- Analysis history
CREATE TABLE analyses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id),
  type       TEXT CHECK (type IN ('daily', 'weekly')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_macro_code_date
  ON macro_indicators (code, period_date DESC);

CREATE INDEX idx_sectoral_sector_code_date
  ON sectoral_indicators (sector, code, period_date DESC);

CREATE INDEX idx_stock_ticker_code_date
  ON stock_indicators (ticker, code, period_date DESC);

CREATE INDEX idx_analyses_user_type_date
  ON analyses (user_id, type, created_at DESC);
```

**Note:** Temporal uses a separate PostgreSQL database (`temporal`) on the same instance. The app uses `investment_advisor`. Same Postgres container, different databases — no connection conflicts.

---

## 6. Environment Variables

See `.env.example` at the project root — that file is the source of truth for all required environment variables.

---

## 7. Docker Compose Services

| Service | Image | Purpose | Port |
|---|---|---|---|
| `nestjs-app` | custom build | NestJS backend + Telegram bot | 3000 (internal) |
| `temporal` | `temporalio/auto-setup` | Temporal server + worker | 7233 (internal) |
| `temporal-ui` | `temporalio/ui` | Workflow monitoring dashboard | 8080 (internal) |
| `postgresql` | `postgres:16` | App DB + Temporal DB | 5432 (internal) |
| `caddy` | `caddy:alpine` | Reverse proxy + auto SSL | 80, 443 (public) |

**Network:** All services on a private Docker bridge network. Only Caddy is exposed publicly.

**Volumes:** `postgres_data`, `caddy_data`

**Restart policy:** `restart: unless-stopped` on all services.

---

## 8. Key Technical Decisions

### Why Temporal over BullMQ?

The collect → analyze → send pipeline spans multiple steps where any can fail independently. Temporal checkpoints each step — if the server restarts after AI analysis but before sending, the workflow resumes at the send step. BullMQ would restart the entire job. For a pipeline involving paid LLM calls, not re-running the AI step on every failure is meaningful.

BullMQ also requires Redis as a separate dependency. Temporal uses PostgreSQL — the same instance already running for the app DB — keeping the infrastructure lean.

### Why NestJS cron over Temporal Schedules?

Five fixed cron expressions don't need the complexity of Temporal's scheduling API. NestJS `@Cron()` is simpler to set up and debug. If scheduling requirements grow (per-user timezones, configurable times), Temporal Schedules can replace it with minimal workflow changes.

### Why one PostgreSQL instance for both app and Temporal?

Reduces VM resource usage. Temporal uses its own database (`temporal`) on the same Postgres instance. No extra container, no connection conflicts.

### Why Caddy over nginx?

Caddy handles SSL certificate provisioning and renewal automatically. On a single VM with no dedicated ops team, eliminating certificate management is meaningful.

### Why batch indicators into one LLM call?

Each `generateText()` call has overhead (connection, authentication, response streaming). All indicators for a ticker are batched into one call — faster and cheaper than one call per indicator. `MODEL_FAST`'s context window comfortably fits a full indicator snapshot for one ticker.

### Why weekly analysis reads stored daily analyses?

Raw indicators are verbose. Stored daily analyses are already 2-3 sentence summaries per data point. Reading up to 5 × raw indicator sets = large input, high cost. Reading the week's available daily analyses = small input, low cost. Sonnet synthesizes trend narrative from however many analyses exist — public holidays and collection failures simply mean fewer inputs, not a blocked delivery.

---

## 9. Dependencies

```json
{
  "dependencies": {
    "@nestjs/common": "^11",
    "@nestjs/core": "^11",
    "@nestjs/config": "^3",
    "@nestjs/schedule": "^4",
    "@nestjs/typeorm": "^10",
    "typeorm": "^0.3",
    "pg": "^8",
    "nestjs-temporal-core": "^3",
    "@temporalio/client": "^1",
    "@temporalio/worker": "^1",
    "@temporalio/workflow": "^1",
    "@temporalio/activity": "^1",
    "telegraf": "^4",
    "ai": "^4",
    "@ai-sdk/openai": "^1",
    "axios": "^1",
    "cheerio": "^1",
    "zod": "^3",
    "date-fns": "^3",
    "winston": "^3"
  }
}
```

---

## 10. Implementation Roadmap

```
Phase 1 — Infrastructure (day 1–2)
  ☐ Init NestJS project + TypeORM + nestjs-temporal-core
  ☐ Setup PostgreSQL via Docker (app DB + Temporal DB)
  ☐ Create 5 tables + migrations
  ☐ Scaffold all modules (Collector, Indicator, AI, Telegram, Temporal, Scheduler)
  ☐ Temporal worker setup with task queue

Phase 2 — Collectors (day 3–6)
  ☐ FredCollector    → IDR/USD           (easiest — REST JSON API)
  ☐ BiRateCollector  → BI Rate           (scrape bi.go.id)
  ☐ BpsCollector     → GDP, CPI, Household Consumption
  ☐ IkkCollector     → Consumer Confidence Index
  ☐ OjkSpiCollector  → NPL, NIM, CAR, Loan growth
  ☐ IprCollector     → Retail Sales Index
  ☐ IdxPriceCollector → PRICE_BBCA, PRICE_ERAA
  ☐ FinancialReportCollector → quarterly reports from IDX

Phase 3 — Temporal Workflows (day 7–8)
  ☐ CollectActivity wrapping all collectors
  ☐ collectDailyWorkflow, collectWeeklyWorkflow, collectMonthlyWorkflow
  ☐ AnalyzeActivity + analyzeDailyWorkflow + analyzeWeeklyWorkflow
  ☐ SendActivity + error notification path

Phase 4 — AI & Telegram (day 9–10)
  ☐ AIService: analyzeStock() prompt engineering for BBCA & ERAA
  ☐ AIService: generateWeeklySummary()
  ☐ TelegramService: webhook setup, all commands
  ☐ SchedulerService: all 5 cron jobs wired to Temporal

Phase 5 — API & Finalization (day 11–12)
  ☐ REST API GET /indicators (macro, sectoral, stock, latest)
  ☐ Docker Compose with Caddy, Temporal UI
  ☐ Winston logging + error monitoring
  ☐ End-to-end test: collect → analyze → Telegram delivery
```

---

## 11. VM Sizing

| Component | RAM estimate |
|---|---|
| NestJS app | ~200 MB |
| Temporal server | ~400 MB |
| Temporal UI | ~100 MB |
| PostgreSQL | ~300 MB |
| Caddy | ~30 MB |
| OS + headroom | ~500 MB |
| **Total** | **~1.5 GB** |

**Recommended minimum:** 2 vCPU / 4 GB RAM / 40 GB SSD

Suitable providers: Hetzner CX22 (~€4.15/mo), DigitalOcean Basic ($12/mo), Vultr ($12/mo).
