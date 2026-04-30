# Notes

Supplementary reference material not tracked in the architecture document.

---

## Planned Collectors (Not Yet Implemented)

Three collectors are live; five remain. Full target mapping:

| Collector | Source | Indicators | Layer | Relevant for |
|-----------|--------|------------|-------|--------------|
| `bi-rate.collector` ✅ | bi.go.id (scrape) | `BI_RATE` | Macro | BBCA, ERAA |
| `fred.collector` ✅ | FRED API | `IDR_USD` | Macro | BBCA, ERAA |
| `idx-price.collector` ✅ | EODHD API | `PRICE_BBCA`, `PRICE_ERAA` | Stock | BBCA, ERAA |
| `ikk.collector` | bi.go.id | `IKK` (Consumer Confidence Index) | Macro | ERAA |
| `bps.collector` | bps.go.id | `GDP_GROWTH`, `CPI_ID`, `HOUSEHOLD_CONSUMPTION` | Macro | BBCA, ERAA |
| `ojk-spi.collector` | OJK | `NPL_BANKING`, `NIM_BANKING`, `CAR_BANKING`, `LOAN_GROWTH` | Sectoral (banking) | BBCA |
| `ipr.collector` | bps.go.id | `IPR_RETAIL`, `RETAIL_SALES_GROWTH` | Sectoral (retail_tech) | ERAA |
| `financial-report.collector` | IDX | `CASA_BBCA`, `NPL_BBCA`, `SSSG_ERAA`, `DAYS_INV_ERAA` | Stock | BBCA, ERAA |

Sectoral collectors feed `sectoral_indicators`; financial report collector feeds `stock_indicators` alongside the price collector.

---

## Planned Workflows (Not Yet Implemented)

### `collectWeeklyWorkflow()`

Triggered Monday 08:00 WIB. Collects slower-moving sectoral data.

```
1. collectOjkSpi()   → NPL_BANKING, NIM_BANKING, CAR_BANKING, LOAN_GROWTH
2. collectIpr()      → IPR_RETAIL, RETAIL_SALES_GROWTH
```

### `collectMonthlyWorkflow()`

Triggered 2nd of each month 08:00 WIB. Collects low-frequency macro and fundamentals.

```
1. collectIkk()              → IKK
2. collectBps()              → GDP_GROWTH, CPI_ID, HOUSEHOLD_CONSUMPTION
3. collectFinancialReports() → CASA_BBCA, NPL_BBCA, SSSG_ERAA, DAYS_INV_ERAA, etc.
```

### `analyzeWeeklyWorkflow(chatId: number)`

Triggered Saturday 08:00 WIB. Reads stored daily analyses — not raw indicators — to keep LLM input small.

```
1. fetchStoredAnalyses({ since: startOfWeek })
       → AnalysisRepository: daily analyses from Mon–Fri of current week
       → returns string[] (1–5 entries; tolerates holidays and collection failures)
2. generateWeeklySummary(analyses)
       → AIService.generateWeeklySummary() with MODEL_SMART
3. sendTelegramMessage(chatId, text)
       → delivers narrative weekly review
```

The weekly workflow proceeds with however many daily analyses exist. A missing day (public holiday, prior failure) is not a blocker.

---

## Implementation Roadmap

```
Phase 1 — Infrastructure ✅
  ✅ NestJS project + TypeORM + Temporal worker
  ✅ PostgreSQL entities (5 tables)
  ✅ All modules scaffolded
  ✅ Temporal worker + task queue wired

Phase 2 — Collectors (partial ✅)
  ✅ FredCollector      → IDR_USD
  ✅ BiRateCollector    → BI_RATE
  ✅ IdxPriceCollector  → PRICE_BBCA, PRICE_ERAA
  ☐ IkkCollector       → IKK
  ☐ BpsCollector       → GDP_GROWTH, CPI_ID, HOUSEHOLD_CONSUMPTION
  ☐ OjkSpiCollector    → NPL_BANKING, NIM_BANKING, CAR_BANKING, LOAN_GROWTH
  ☐ IprCollector       → IPR_RETAIL, RETAIL_SALES_GROWTH
  ☐ FinancialReportCollector → quarterly reports from IDX

Phase 3 — Temporal Workflows (partial ✅)
  ✅ CollectActivity (3 collectors)
  ✅ collectDailyWorkflow
  ✅ analyzeDailyWorkflow + onDemandAnalysisWorkflow
  ✅ SendActivity + error notification path
  ☐ collectWeeklyWorkflow
  ☐ collectMonthlyWorkflow
  ☐ analyzeWeeklyWorkflow

Phase 4 — AI & Telegram
  ☐ AIService: analyzeStock() — prompt engineering for BBCA & ERAA
  ☐ AIService: generateWeeklySummary()
  ☐ TelegramService: /analyze command → onDemandAnalysisWorkflow
  ☐ TelegramService: /latest command → IndicatorService.getLatestSnapshot()

Phase 5 — Finalization
  ☐ Production Docker Compose (PostgreSQL, Temporal, app)
  ☐ Structured logging
  ☐ End-to-end test: collect → analyze → Telegram delivery
```

---

## VM Sizing

| Component | RAM estimate |
|-----------|-------------|
| NestJS app | ~200 MB |
| Temporal server | ~400 MB |
| Temporal UI | ~100 MB |
| PostgreSQL | ~300 MB |
| Nginx Proxy Manager | ~50 MB |
| OS + headroom | ~500 MB |
| **Total** | **~1.5 GB** |

**Recommended minimum:** 2 vCPU / 4 GB RAM / 40 GB SSD

Suitable providers: Hetzner CX22 (~€4.15/mo), DigitalOcean Basic ($12/mo), Vultr ($12/mo).

---

## Database Indexes

Recommended indexes for production (not yet in migrations):

```sql
CREATE INDEX idx_macro_code_date
  ON macro_indicators (code, period_date DESC);

CREATE INDEX idx_sectoral_sector_code_date
  ON sectoral_indicators (sector, code, period_date DESC);

CREATE INDEX idx_stock_ticker_code_date
  ON stock_indicators (ticker, code, period_date DESC);

CREATE INDEX idx_analyses_user_type_date
  ON analyses (user_id, type, created_at DESC);
```

These align with the `DISTINCT ON` queries in `IndicatorService` and the weekly analysis fetch by `(user_id, type, created_at)`.

---

## AI Cost Optimization Rules

- All indicators for a ticker are batched into a single `generateText()` call — no per-indicator calls.
- Weekly review reads stored daily `Analysis` records from the DB, not raw indicators. A week of 5 daily text summaries is far cheaper than 5 × full indicator snapshots.
- `MODEL_FAST` (`MODEL_FAST` env var) for daily stock analysis — optimized for cost.
- `MODEL_SMART` (`MODEL_SMART` env var) for weekly narrative synthesis — optimized for quality.
- Both models must be available at `LLM_BASE_URL` (OpenAI-compatible endpoint). Default provider is Fireworks AI via Tailscale Aperture; swap by changing `LLM_BASE_URL` without touching code.
