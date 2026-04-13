# Investment Advisor Telegram Bot

A RAG-based Telegram bot that collects Indonesian macro, sectoral, and emiten indicators, then delivers AI-generated daily and weekly investment digests for BBCA and ERAA to subscribed users.

## What it does

- Collects economic and market data from BI, BPS, OJK, FRED, and IDX on a scheduled basis
- Stores the latest indicator values in PostgreSQL
- Generates investment analysis by feeding those indicators to Claude (Haiku for daily, Sonnet for weekly)
- Delivers formatted digests to subscribed users via Telegram

## Stack

- **NestJS** — application framework
- **Temporal** — durable workflow orchestration (collect → analyze → send pipeline)
- **PostgreSQL** — indicator storage and analysis history
- **Telegraf** — Telegram bot (webhook mode)
- **Vercel AI SDK + Anthropic** — LLM calls
- **Caddy** — reverse proxy and automatic SSL
- **Docker Compose** — local and production deployment

## Bot commands

| Command | Description |
|---|---|
| `/start` | Subscribe to receive daily and weekly digests |
| `/stop` | Unsubscribe |
| `/analyze` | Request an on-demand analysis immediately |
| `/latest` | Show the latest raw indicator values (no AI) |
| `/help` | Show available commands and delivery schedule |

## Delivery schedule

| Digest | Schedule |
|---|---|
| Daily digest (BBCA + ERAA) | 07:00 WIB, Monday–Friday |
| Weekly digest (top-down analysis) | Saturday 08:00 WIB |

## Project setup

```bash
npm install
```

## Running the app

```bash
# development
npm run start

# watch mode
npm run start:dev

# production mode
npm run start:prod
```

## Running tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
PORT=3000
NODE_ENV=development

DATABASE_URL=postgresql://postgres:password@localhost:5432/investment_advisor

TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=investment-advisor

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_URL=https://your-domain.com/telegram/webhook

FRED_API_KEY=
SCRAPER_DELAY_MS=2000

ANTHROPIC_API_KEY=

CRON_DAILY_COLLECT=0 7 * * 1-5
CRON_WEEKLY_COLLECT=0 8 * * 1
CRON_MONTHLY_COLLECT=0 8 2 * *
CRON_WEEKLY_ANALYSIS=0 8 * * 6
```

## Running with Docker Compose

```bash
docker compose up -d
```

Services: `nestjs-app`, `temporal`, `temporal-ui` (port 8080), `postgresql`, `caddy`

## Documentation

- [Product Requirements](docs/prd.md)
- [Technical Architecture](docs/agent-architecture.md)
