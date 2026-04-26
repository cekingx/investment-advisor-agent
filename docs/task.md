# User Story 2: Receive Daily Digest for BBCA and ERAA

**As a** subscriber
**I want to** receive a brief daily digest about BBCA and ERAA
**So that** I know what happened to the economy and markets that day

---

## Task 1: Implement Daily Data Collectors

**Layer**: Backend

---

### User Story Context

**As a** subscriber
**I want to** receive a brief daily digest about BBCA and ERAA
**So that** I know what happened to the economy and markets that day

---

### Technical Scope

#### Collectors to Implement

- `BiRateCollector` — Scrapes BI Rate from bi.go.id (HTML parse via cheerio); produces `BI_RATE` in `macro_indicators`
- `FredCollector` — Fetches IDR/USD exchange rate from FRED REST API; produces `IDR_USD` in `macro_indicators`
- `IdxPriceCollector` — Fetches daily closing prices for BBCA and ERAA from IDX or Yahoo Finance; produces `PRICE_BBCA` and `PRICE_ERAA` in `stock_indicators`

Each collector implements `ICollector`:
- `indicatorCode: string` — e.g. `'BI_RATE'`
- `layer: 'macro' | 'sectoral' | 'stock'`
- `source: string` — source identifier
- `collect(): Promise<IndicatorPayload[]>` — fetches and returns parsed data

#### CollectActivity Functions

- `collectBiRate()` — invokes `BiRateCollector.collect()`, upserts result into `macro_indicators`
- `collectFred()` — invokes `FredCollector.collect()`, upserts `IDR_USD` into `macro_indicators`
- `collectIdxPrices()` — invokes `IdxPriceCollector.collect()`, upserts `PRICE_BBCA` and `PRICE_ERAA` into `stock_indicators`

Activity config: timeout 3 min, 3 retries, exponential backoff (10s → 30s → 90s).

#### Database Changes

- Tables already defined: `macro_indicators`, `stock_indicators` — no migration needed if schema is in place
- All writes use upsert on `(code, period_date)` for macro and `(ticker, code, period_date)` for stock — safe to re-run on retry

#### REST API

- Existing endpoint reused: `GET /indicators/latest` — returns all latest indicator values (used by `/latest` Telegram command)

---

### Notes

- bi.go.id HTML structure may change — scraping logic is fragile; log raw HTML on parse failure for debugging
- FRED API requires an API key (`FRED_API_KEY` env var)
- Yahoo Finance is unofficial and may throttle; IDX endpoint is preferred if available
- `upsert` behavior must be idempotent — retried activities must not create duplicate rows
- Depends on database schema and migrations being in place (Phase 1 prerequisite)

---

### Implementation Tasks

- [x] Implement `BiRateCollector.collect()` with cheerio HTML parsing and error handling
- [x] Implement `FredCollector.collect()` with Axios REST call and JSON parsing
- [x] Implement `IdxPriceCollector.collect()` with price fetch and ticker mapping
- [x] Implement `CollectActivity` methods: `collectBiRate`, `collectFred`, `collectIdxPrices`
- [x] Configure activity retry policy (timeout, retries, backoff) in activity registration
- [x] Add upsert logic in repository for `macro_indicators` and `stock_indicators`
- [x] Add structured logging on fetch errors and parse failures
- [x] Write unit tests for each collector with mocked HTTP responses
- [x] Write integration test for `CollectActivity` against real or stubbed DB

---

### Definition of Done

- [ ] Code implemented according to specifications
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Merged to main branch
- [ ] Deployed to staging
- [ ] QA verified

---

## Task 2: Implement Temporal Workflows for Daily Collection and Analysis

**Layer**: Backend

---

### User Story Context

**As a** subscriber
**I want to** receive a brief daily digest about BBCA and ERAA
**So that** I know what happened to the economy and markets that day

---

### Technical Scope

#### Workflows to Implement

**`collectDailyWorkflow()`**
- Calls `collectBiRate()`, `collectFred()`, `collectIdxPrices()` sequentially via `proxyActivities()`
- After all collection activities succeed, spawns `analyzeDailyWorkflow(chatId)` as a child workflow for each subscribed user via `startChild()`
- Guarantees indicators are persisted before any analysis reads from the DB

**`analyzeDailyWorkflow(chatId: number)`**
- Calls `fetchLatestIndicators()` → `analyzeStocks(snapshot)` → `sendTelegramMessage({ chatId, text })` via `proxyActivities()`
- On any unrecoverable failure (all retries exhausted), calls `sendErrorNotification({ chatId, error })` in a catch block

**`onDemandAnalysisWorkflow(chatId: number)`**
- Identical logic to `analyzeDailyWorkflow`
- Workflow ID must include `chatId + timestamp` to prevent duplicate execution conflicts

#### AnalyzeActivity Functions

- `fetchLatestIndicators()` — reads latest values from `macro_indicators`, `sectoral_indicators`, `stock_indicators` via `IndicatorRepository.getLatest()`; returns `IndicatorSnapshot`
- `analyzeStocks(snapshot)` — calls `AIService.analyzeStock()` for BBCA and ERAA; returns formatted markdown strings; saves each result to `analyses` table with `type: 'daily'`

Activity config: timeout 5 min, 3 retries, initial interval 10s.

#### SendActivity Functions

- `sendTelegramMessage({ chatId, text })` — calls `TelegramService.sendMessage(chatId, text)` to push digest to user
- `sendErrorNotification({ chatId, error })` — calls `TelegramService.sendErrorNotification(chatId, error)` when workflow fails

Activity config: timeout 1 min, 5 retries, backoff coefficient 1.5, initial interval 5s.

#### Scheduler

- `SchedulerService` method with `@Cron("0 7 * * 1-5")` decorator — calls `TemporalClient.start(collectDailyWorkflow)` at 07:00 WIB on weekdays

#### Database Changes

- `analyses` table: stores `user_id`, `type = 'daily'`, `content` (markdown text), `created_at` — needed for weekly digest source material
- No new migrations if table is already defined; confirm `AnalysisRepository.saveAnalysis(userId, text, 'daily')` is wired

---

### Notes

- Workflows must not import NestJS modules — only call activities via `proxyActivities()`
- `startChild()` in `collectDailyWorkflow` must query subscribed users from the DB inside an activity, not directly in workflow code
- `onDemandAnalysisWorkflow` must use a unique workflow ID to allow concurrent on-demand requests from different users
- Temporal uses a separate DB (`temporal`) on the same Postgres instance — no connection conflicts but keep connections scoped
- Depends on Task 1 (collectors and CollectActivity) and Task 3 (AIService) being complete before end-to-end test

---

### Implementation Tasks

- [x] Implement `collectDailyWorkflow` with sequential activity calls and child workflow spawn per user
- [x] Implement `analyzeDailyWorkflow` with fetch → analyze → send chain and error catch block
- [x] Implement `onDemandAnalysisWorkflow` with unique workflow ID generation
- [x] Implement `AnalyzeActivity.fetchLatestIndicators()` reading from all three indicator tables
- [x] Implement `AnalyzeActivity.analyzeStocks()` calling AIService and saving result to `analyses`
- [x] Implement `SendActivity.sendTelegramMessage()` and `sendErrorNotification()`
- [x] Configure activity retry policies for AnalyzeActivity and SendActivity
- [x] Register all activities and workflows with the Temporal worker task queue
- [x] Implement `SchedulerService` cron job triggering `collectDailyWorkflow` via TemporalClient
- [x] Add a `fetchSubscribedUsers()` activity for use inside `collectDailyWorkflow` to get chat IDs
- [x] Write workflow unit tests using Temporal test environment
- [x] Write integration test for full collect → analyze → send pipeline in test environment

---

### Definition of Done

- [ ] Code implemented according to specifications
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Merged to main branch
- [ ] Deployed to staging
- [ ] QA verified

---

## Task 3: Implement AI Analysis Service for Daily Digest

**Layer**: Backend

---

### User Story Context

**As a** subscriber
**I want to** receive a brief daily digest about BBCA and ERAA
**So that** I know what happened to the economy and markets that day

---

### Technical Scope

#### AIService Functions

- `analyzeStock(ticker: string, indicators: IndicatorSnapshot)` — receives macro, sectoral, and stock indicators for a given ticker; calls `generateText()` via `@ai-sdk/openai`; returns a Telegram-formatted markdown string with sections per stock

#### Model Configuration

- Uses `MODEL_FAST` env var as the model identifier (OpenAI-compatible format, e.g. `anthropic/claude-haiku-4-5` on OpenRouter)
- Provider base URL and API key sourced from env vars (`OPENROUTER_BASE_URL`, `OPENROUTER_API_KEY` or equivalent)
- All indicators for a ticker batched into a single `generateText()` call — no per-indicator calls

#### Prompt Design

- System prompt: defines the role (investment analyst), output format (Telegram markdown, sections per stock), and language constraints
- User prompt: structured indicator snapshot — macro indicators, then stock-specific values — formatted for readability
- Output must be valid Telegram markdown (no unsupported tags); test formatting in bot before finalizing prompt

#### Database Changes

- None — `AIService` is stateless; analysis output is saved by `AnalyzeActivity`, not by AIService directly

---

### Notes

- OpenRouter or equivalent OpenAI-compatible provider must be configured; `@ai-sdk/openai` is used with a custom `baseURL`
- `MODEL_FAST` must be set in `.env` — document in `.env.example`
- Prompt token count should be validated against model context window limits; add env var `MAX_INDICATOR_COUNT` as a safety cap if needed
- Telegram markdown uses `*bold*`, `_italic_`, `` `code` `` — avoid HTML tags or unsupported syntax
- Error from `generateText()` should propagate to `AnalyzeActivity` for retry handling — do not swallow exceptions in AIService

---

### Implementation Tasks

- [ ] Set up `@ai-sdk/openai` with custom `baseURL` and API key from env
- [ ] Implement `AIService.analyzeStock(ticker, indicators)` with `generateText()` call
- [ ] Design and iterate on the system prompt for structured Telegram markdown output
- [ ] Design the user prompt template that maps `IndicatorSnapshot` fields into readable text
- [ ] Validate output formatting in a real Telegram chat before finalizing
- [ ] Add error propagation (do not catch inside AIService — let activity handle retries)
- [ ] Document `MODEL_FAST`, `OPENROUTER_BASE_URL`, `OPENROUTER_API_KEY` in `.env.example`
- [ ] Write unit tests for `analyzeStock()` with mocked `generateText()` response
- [ ] Write a manual/smoke test against the real provider to validate prompt quality

---

### Definition of Done

- [ ] Code implemented according to specifications
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Merged to main branch
- [ ] Deployed to staging
- [ ] QA verified

---

## Task 4: Implement Telegram Bot Commands for Daily Digest

**Layer**: Backend

---

### User Story Context

**As a** subscriber
**I want to** receive a brief daily digest about BBCA and ERAA
**So that** I know what happened to the economy and markets that day

---

### Technical Scope

#### TelegramService Functions

- `onAnalyze(ctx)` — handler for `/analyze` command; replies with an acknowledgement message ("Fetching latest analysis…"); calls `TemporalClient.start(onDemandAnalysisWorkflow, { workflowId: 'analyze-{chatId}-{timestamp}', args: [chatId] })`
- `onLatest(ctx)` — handler for `/latest` command; queries `GET /indicators/latest` (or calls `IndicatorService` directly); formats and sends raw indicator values to user without triggering AI
- `sendMessage(chatId: number, text: string)` — sends a formatted markdown message to a Telegram chat; called by `SendActivity`
- `sendErrorNotification(chatId: number, error: string)` — sends a user-friendly failure message ("⚠️ Analysis failed. Will retry at the next scheduled run."); called from workflow catch block

#### Webhook

- Telegraf configured in webhook mode
- NestJS exposes `POST /telegram/webhook` — register this endpoint with the Telegram Bot API using the public HTTPS URL (handled by Caddy)
- Bot token sourced from `TELEGRAM_BOT_TOKEN` env var

#### Indicator Query for `/latest`

- Reads from all three indicator tables via `IndicatorService.getLatest()` or directly via repository
- No AI call — raw values only
- Format: plain text or minimal markdown table showing code, value, unit, and period date

---

### Notes

- Webhook URL must match the Caddy-proxied public domain — set via `TELEGRAM_WEBHOOK_URL` env var or equivalent
- `onAnalyze` must not block on workflow completion — fire and forget, reply immediately
- `/latest` response must handle the case where no indicators are in the DB yet (e.g. first run)
- `sendMessage` must handle Telegram API rate limits — Telegraf handles most of this but log any 429 responses
- `sendErrorNotification` must never throw — swallow errors silently to avoid secondary failure in workflow catch block
- Depends on Task 2 (`onDemandAnalysisWorkflow`) being registered with Temporal before `/analyze` can function end-to-end

---

### Implementation Tasks

- [ ] Implement `onAnalyze(ctx)` handler with immediate reply and Temporal workflow start
- [ ] Implement `onLatest(ctx)` handler with DB query and formatted indicator response
- [ ] Implement `sendMessage(chatId, text)` for outbound digest delivery
- [ ] Implement `sendErrorNotification(chatId, error)` with safe error swallowing
- [ ] Register all command handlers with Telegraf (`bot.command('analyze', ...)`, etc.)
- [ ] Configure Telegraf in webhook mode with `POST /telegram/webhook` NestJS endpoint
- [ ] Add `TELEGRAM_BOT_TOKEN` and webhook URL to `.env.example`
- [ ] Handle edge case: `/latest` when indicator tables are empty
- [ ] Test all commands manually in a Telegram test bot
- [ ] Write unit tests for handler logic with mocked Telegraf context and TemporalClient

---

### Definition of Done

- [ ] Code implemented according to specifications
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Merged to main branch
- [ ] Deployed to staging
- [ ] QA verified
