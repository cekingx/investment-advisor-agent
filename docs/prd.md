# Product Requirements Document

## Document Overview

- **Goal**: Build an investment advisor Telegram bot that collects Indonesian macro, sectoral, and stock indicators, then delivers AI-generated daily and weekly digests for BBCA and ERAA to subscribed users.
- **Status**: Draft

---

## Epic 1: Bot Subscription Management

### Epic Description

Allow users to subscribe to and manage their subscription to the investment advisor bot via Telegram commands. This is the entry point for all users — without subscription, no digest is delivered.

### Business Value

Users need a simple, frictionless way to opt in and out of receiving investment digests. Subscription management ensures digests are only sent to users who want them, and gives users control over their experience.

---

### User Story 1: Subscribe to Investment Advisor Bot

**As a** user
**I want to** subscribe to the investment advisor bot
**So that** I can receive daily and weekly investment digests automatically

**Estimate**: 3 story points

---

#### Acceptance Criteria (User Perspective)

- [x] User can send `/start` to the bot and receive a confirmation message that subscription is active
- [x] User sees a description of what digests they will receive and when (daily at 07:00 WIB, weekly on Saturday at 08:00 WIB)
- [x] User can send `/stop` to deactivate their subscription and receive a confirmation
- [x] User can send `/help` to see a list of available commands and the delivery schedule
- [x] User does not receive digests after sending `/stop`
- [x] User can re-subscribe by sending `/start` again after stopping

---

#### Notes

- Telegram bot operates in webhook mode, not polling
- User identity is tied to their Telegram chat ID
- `/start` and `/stop` must be idempotent — re-subscribing or re-stopping should not cause errors

---

#### Definition of Done

- [ ] All related implementation tasks completed
- [ ] All acceptance criteria met
- [ ] Code reviewed and merged
- [ ] Tested in staging environment
- [ ] Stakeholder sign-off received

---

## Epic 2: Investment Digest Delivery

### Epic Description

Automatically collect Indonesian economic and market data, analyze it using AI, and deliver formatted investment digests to subscribed users via Telegram. Covers both a brief daily snapshot and a comprehensive weekly top-down analysis for BBCA and ERAA.

### Business Value

Subscribers currently have no automated, consolidated source of investment-relevant data for BBCA and ERAA. Manual research is time-consuming and fragmented across multiple sources (BI, BPS, OJK, IDX, FRED). This epic eliminates that friction by delivering concise, AI-synthesized analysis directly to Telegram.

---

### User Story 2: Receive Daily Digest for BBCA and ERAA

**As a** subscriber
**I want to** receive a brief daily digest about BBCA and ERAA
**So that** I know what happened to the economy and markets that day

**Estimate**: 5 story points

---

#### Acceptance Criteria (User Perspective)

- [ ] Subscriber receives a daily digest automatically at 07:00 WIB on each trading day
- [ ] Digest covers both BBCA and ERAA with key macro indicators (BI Rate, IDR/USD exchange rate, stock prices)
- [ ] Digest is formatted in readable Telegram markdown with clear sections per stock
- [ ] Subscriber can request an on-demand digest at any time by sending `/analyze`
- [ ] Subscriber can view the latest raw indicator values without AI analysis by sending `/latest`
- [ ] If digest delivery fails after all retries, subscriber receives a notification explaining the failure and when the next delivery will occur

---

#### Notes

- Daily digest uses the model configured in `MODEL_FAST` for cost efficiency
- On-demand `/analyze` triggers the same workflow as the scheduled daily digest
- Workflow is durable via Temporal — if analysis completes but send fails, only the send step retries

---

#### Definition of Done

- [ ] All related implementation tasks completed
- [ ] All acceptance criteria met
- [ ] Code reviewed and merged
- [ ] Tested in staging environment
- [ ] Stakeholder sign-off received

---

### User Story 3: Receive Weekly Digest with Top-Down Analysis for BBCA and ERAA

**As a** subscriber
**I want to** receive a weekly digest about BBCA and ERAA with top-down analysis
**So that** I can make informed decisions about my investment position

**Estimate**: 5 story points

---

#### Acceptance Criteria (User Perspective)

- [ ] Subscriber receives a weekly digest automatically every Saturday at 08:00 WIB
- [ ] Weekly digest synthesizes the week's macro, sectoral, and stock developments into a cohesive narrative
- [ ] Digest follows a top-down structure: macro environment → sectoral context → stock-specific implications for both BBCA and ERAA
- [ ] Digest includes an investment outlook or actionable signal per stock (e.g., conditions are improving, headwinds remain)
- [ ] Weekly digest is noticeably more detailed and narrative than the daily digest
- [ ] Subscriber receives the weekly digest independently of whether they received all daily digests that week

---

#### Notes

- Weekly digest uses the model configured in `MODEL_SMART` for higher-quality narrative synthesis
- Source material is the 7 stored daily analyses from the past week — not raw indicators — to minimize token cost
- Weekly collection workflow runs Monday 08:00 WIB; monthly collection on the 2nd of each month — data is available well before Saturday delivery

---

#### Definition of Done

- [ ] All related implementation tasks completed
- [ ] All acceptance criteria met
- [ ] Code reviewed and merged
- [ ] Tested in staging environment
- [ ] Stakeholder sign-off received

---

## Technical Implementation Summary

**Key Technical Points:**

- Telegram bot in webhook mode via Telegraf; NestJS exposes `POST /telegram/webhook`; Nginx Proxy Manager handles HTTPS and certificate provisioning via Let's Encrypt
- Temporal orchestrates the durable collect → analyze → send pipeline; workflow checkpointing ensures paid LLM calls are not re-run on delivery failures
- Data collection spans 8 collectors across macro (BI, BPS, FRED), sectoral (OJK, BPS), and stock (IDX, Yahoo Finance) layers; each collector activity has 3 retries with exponential backoff
- AI analysis uses `@ai-sdk/openai` via an OpenAI-compatible API (`LLM_BASE_URL`); default provider is Fireworks AI via Tailscale Aperture: `MODEL_FAST` for daily stock analysis (cost-optimized), `MODEL_SMART` for weekly narrative synthesis (quality-optimized)
- PostgreSQL stores indicator time-series and analysis history; Temporal uses a separate database on the same instance
- NestJS `@Cron()` triggers Temporal workflow starts on 5 schedules: daily collection/analysis (07:00 WIB), weekly collection (Monday 08:00 WIB), weekly analysis (Saturday 08:00 WIB), monthly collection (2nd of month 08:00 WIB)
- All services run in Docker Compose on a private bridge network; only Caddy is publicly exposed
