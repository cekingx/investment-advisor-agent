# Technical Architecture: Top-Down Stock Data Collector

> NestJS backend untuk pengambilan & penyimpanan indikator top-down saham secara rutin
> Stack: NestJS · TypeScript · PostgreSQL · BullMQ · Redis

---

## 1. Overview Sistem

```
┌──────────────────────────────────────────────────┐
│                 NestJS Application                │
│                                                  │
│  ┌─────────────┐    ┌────────────┐               │
│  │  Scheduler  │───▶│   Queue    │               │
│  │  (cron)     │    │  (BullMQ)  │               │
│  └─────────────┘    └─────┬──────┘               │
│                           │                      │
│                    ┌──────▼──────┐               │
│                    │  Collector  │               │
│                    │  (HTTP/     │               │
│                    │  Scraper)   │               │
│                    └──────┬──────┘               │
│                           │                      │
│                    ┌──────▼──────┐               │
│                    │  Repository │               │
│                    │  (TypeORM)  │               │
│                    └──────┬──────┘               │
└───────────────────────────┼──────────────────────┘
                            │
               ┌────────────┴────────────┐
               │       PostgreSQL        │
               │     (time-series)       │
               └─────────────────────────┘
```

---

## 2. Struktur Direktori

```
src/
├── app.module.ts
│
├── config/
│   ├── app.config.ts
│   ├── database.config.ts
│   └── sources.config.ts          # URL & API key per sumber data
│
├── modules/
│   ├── scheduler/
│   │   ├── scheduler.module.ts
│   │   └── scheduler.service.ts   # Definisi semua cron job
│   │
│   ├── collector/
│   │   ├── collector.module.ts
│   │   │
│   │   ├── macro/
│   │   │   ├── bi-rate.collector.ts        # BI Rate → bi.go.id
│   │   │   ├── ikk.collector.ts            # Indeks Keyakinan Konsumen → bi.go.id
│   │   │   ├── bps.collector.ts            # GDP, CPI → bps.go.id
│   │   │   └── fred.collector.ts           # Kurs, inflasi global → FRED API
│   │   │
│   │   ├── sectoral/
│   │   │   ├── banking/
│   │   │   │   └── ojk-spi.collector.ts    # NPL, NIM, CAR, Loan growth → OJK
│   │   │   └── retail-tech/
│   │   │       └── ipr.collector.ts        # Indeks Penjualan Riil → BPS
│   │   │
│   │   └── stock/
│   │       ├── idx-price.collector.ts      # Harga saham → IDX / Yahoo Finance
│   │       └── financial-report.collector.ts  # Laporan keuangan → IDX
│   │
│   ├── queue/
│   │   ├── queue.module.ts
│   │   ├── collect.producer.ts     # Enqueue jobs
│   │   └── collect.consumer.ts     # Process jobs → panggil collector
│   │
│   └── indicator/
│       ├── indicator.module.ts
│       ├── indicator.controller.ts # REST API untuk query data
│       └── indicator.service.ts    # Query ke repository
│
├── database/
│   ├── entities/
│   │   ├── macro-indicator.entity.ts
│   │   ├── sectoral-indicator.entity.ts
│   │   └── stock-indicator.entity.ts
│   └── migrations/
│
└── common/
    └── utils/
        ├── retry.util.ts           # Retry logic untuk HTTP request
        └── http.util.ts            # Wrapper axios dengan timeout & logging
```

---

## 3. Module Breakdown

### 3.1 Scheduler Module

Menggunakan `@nestjs/schedule`. Tugasnya hanya satu: enqueue job ke BullMQ sesuai jadwal.

```
Setiap hari 07:00 WIB
  └── collect:macro:daily
        ├── BI Rate
        ├── Kurs IDR/USD (FRED)
        └── Harga saham BBCA & ERAA

Setiap Senin 08:00 WIB
  └── collect:sectoral:weekly
        ├── OJK SPI (NPL, NIM, CAR, Loan growth)
        └── IPR BPS (Indeks Penjualan Riil)

Tanggal 2 tiap bulan, 08:00 WIB
  └── collect:macro:monthly
        ├── IKK (Indeks Keyakinan Konsumen)
        ├── GDP & CPI BPS
        └── Laporan keuangan stock (jika periode baru)
```

### 3.2 Collector Module

Setiap collector mengimplementasikan interface `ICollector`:

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

**Mapping collector per indikator:**

| Collector | Indikator | Layer | Relevan untuk | Sumber |
|---|---|---|---|---|
| `bi-rate.collector` | BI_RATE | Makro | BBCA & ERAA | bi.go.id |
| `ikk.collector` | IKK | Makro | ERAA | bi.go.id |
| `fred.collector` | IDR_USD, CPI_GLOBAL | Makro | BBCA & ERAA | FRED API |
| `bps.collector` | GDP_GROWTH, CPI_ID | Makro | BBCA & ERAA | bps.go.id |
| `ojk-spi.collector` | NPL_BANKING, NIM_BANKING, CAR_BANKING, LOAN_GROWTH | Sektoral | BBCA | ojk.go.id |
| `ipr.collector` | IPR_RETAIL | Sektoral | ERAA | bps.go.id |
| `idx-price.collector` | PRICE_BBCA, PRICE_ERAA | Stock | BBCA & ERAA | IDX |
| `financial-report.collector` | CASA_BBCA, NPL_BBCA, SSSG_ERAA, DAYS_INV_ERAA | Stock | BBCA & ERAA | IDX |

### 3.3 Queue Module (BullMQ)

Queue memisahkan **kapan job dijadwalkan** dari **kapan job dieksekusi**, serta menangani retry otomatis jika collector gagal.

```
collect-queue
  │
  ├── Job: collect:macro:daily
  │     └── Consumer memanggil:
  │           BiRateCollector.collect()
  │           FredCollector.collect(['IDR_USD'])
  │           IdxPriceCollector.collect(['BBCA','ERAA'])
  │
  ├── Job: collect:sectoral:weekly
  │     └── Consumer memanggil:
  │           OjkSpiCollector.collect()
  │           IprCollector.collect()
  │
  └── Job: collect:macro:monthly
        └── Consumer memanggil:
              IkkCollector.collect()
              BpsCollector.collect(['GDP','CPI'])
              FinancialReportCollector.collect(['BBCA','ERAA'])

Konfigurasi job:
  attempts: 3
  backoff: { type: 'exponential', delay: 5000 }
  removeOnComplete: true
  removeOnFail: false        # Job gagal tetap disimpan untuk debugging
```

### 3.4 Indicator Module

Menyediakan REST API untuk membaca data yang sudah tersimpan.

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
    # Semua indikator, nilai terbaru saja
```

---

## 4. Database Schema

```sql
-- Indikator makro
CREATE TABLE macro_indicators (
  id           SERIAL PRIMARY KEY,
  code         VARCHAR(50)    NOT NULL,   -- 'BI_RATE', 'GDP_GROWTH', 'IDR_USD'
  value        NUMERIC(18,4)  NOT NULL,
  unit         VARCHAR(20),               -- '%', 'IDR', 'index'
  source       VARCHAR(50)    NOT NULL,   -- 'bi.go.id', 'FRED', 'BPS'
  period_date  DATE           NOT NULL,
  fetched_at   TIMESTAMPTZ    DEFAULT NOW(),
  UNIQUE (code, period_date)
);

-- Indikator sektoral
CREATE TABLE sectoral_indicators (
  id           SERIAL PRIMARY KEY,
  sector       VARCHAR(50)    NOT NULL,   -- 'banking', 'retail_tech'
  code         VARCHAR(50)    NOT NULL,   -- 'NPL_BANKING', 'LOAN_GROWTH'
  value        NUMERIC(18,4)  NOT NULL,
  unit         VARCHAR(20),
  source       VARCHAR(50)    NOT NULL,
  period_date  DATE           NOT NULL,
  fetched_at   TIMESTAMPTZ    DEFAULT NOW(),
  UNIQUE (sector, code, period_date)
);

-- Indikator stock
CREATE TABLE stock_indicators (
  id           SERIAL PRIMARY KEY,
  ticker       VARCHAR(10)    NOT NULL,   -- 'BBCA', 'ERAA'
  code         VARCHAR(50)    NOT NULL,   -- 'CASA_BBCA', 'SSSG_ERAA'
  value        NUMERIC(18,4)  NOT NULL,
  unit         VARCHAR(20),
  source       VARCHAR(50)    NOT NULL,
  period_date  DATE           NOT NULL,
  fetched_at   TIMESTAMPTZ    DEFAULT NOW(),
  UNIQUE (ticker, code, period_date)
);

-- Index untuk query time-series
CREATE INDEX idx_macro_code_date
  ON macro_indicators (code, period_date DESC);

CREATE INDEX idx_sectoral_sector_code_date
  ON sectoral_indicators (sector, code, period_date DESC);

CREATE INDEX idx_stock_ticker_code_date
  ON stock_indicators (ticker, code, period_date DESC);
```

---

## 5. Alur Data End-to-End

```
[07:00 WIB]
SchedulerService (cron trigger)
  │
  ▼
CollectProducer.enqueue('collect:macro:daily')
  │  tambah job ke Redis queue
  ▼
CollectConsumer.process(job)
  │  ambil & eksekusi job
  │
  ├──▶ BiRateCollector.collect()
  │       │  GET bi.go.id → parse HTML
  │       │  → { code:'BI_RATE', value:5.75, unit:'%', periodDate }
  │       └──▶ MacroIndicatorRepository.upsert()
  │               INSERT ... ON CONFLICT (code, period_date) DO UPDATE
  │
  ├──▶ FredCollector.collect(['IDR_USD'])
  │       │  GET api.stlouisfed.org → parse JSON
  │       │  → { code:'IDR_USD', value:16450, unit:'IDR', periodDate }
  │       └──▶ MacroIndicatorRepository.upsert()
  │
  └──▶ IdxPriceCollector.collect(['BBCA','ERAA'])
          │  GET Yahoo Finance / IDX API → parse JSON
          │  → [{ code:'PRICE_BBCA', value:8350 }, ...]
          └──▶ StockIndicatorRepository.upsert()

Jika collector gagal:
  └── BullMQ retry otomatis (max 3x, exponential backoff 5s)
      Setelah 3x gagal → job masuk failed list, bisa di-retry manual
```

---

## 6. Tech Stack & Dependencies

```
Core
├── @nestjs/core
├── @nestjs/schedule          # Cron scheduler
├── @nestjs/bull              # BullMQ integration
├── @nestjs/typeorm           # ORM
└── @nestjs/config            # Env config

HTTP & Scraping
├── axios                     # HTTP client
└── cheerio                   # HTML parser (bi.go.id, bps.go.id)

Database
├── typeorm
├── pg                        # PostgreSQL driver
└── ioredis                   # Redis driver untuk BullMQ

Validation
└── zod                       # Validasi shape response dari sumber eksternal

Utilities
├── date-fns                  # Manipulasi tanggal
└── winston                   # Logging
```

---

## 7. Environment Variables

```bash
# App
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/topdown_stock

# Redis
REDIS_URL=redis://localhost:6379

# API Keys
FRED_API_KEY=your_fred_api_key        # gratis di fred.stlouisfed.org

# Scraping delay (ms) — hindari rate limiting
SCRAPER_DELAY_MS=2000
```

---

## 8. Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: topdown_stock
      POSTGRES_PASSWORD: password
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

---

## 9. Roadmap Implementasi

```
Phase 1 — Infrastruktur (hari 1–2)
  ☐ Init NestJS project + TypeORM + BullMQ
  ☐ Setup PostgreSQL & Redis via Docker
  ☐ Buat 3 tabel + migration
  ☐ Scaffold Scheduler, Queue, Collector module

Phase 2 — Collector Makro (hari 3–5)
  ☐ FredCollector  → IDR/USD, CPI global  (paling mudah, API JSON)
  ☐ BiRateCollector → scrape bi.go.id
  ☐ BpsCollector   → GDP, CPI Indonesia
  ☐ IkkCollector   → Indeks Keyakinan Konsumen

Phase 3 — Collector Sektoral & Stock (hari 6–8)
  ☐ OjkSpiCollector  → NPL, NIM, CAR, Loan growth
  ☐ IprCollector     → Indeks Penjualan Riil
  ☐ IdxPriceCollector → Harga BBCA & ERAA
  ☐ FinancialReportCollector → Laporan keuangan IDX

Phase 4 — API & Finalisasi (hari 9–10)
  ☐ REST API GET /indicators (macro, sectoral, stock, latest)
  ☐ Cron schedule lengkap (harian, mingguan, bulanan)
  ☐ Retry & error logging Winston
  ☐ Bull Board untuk monitor queue (opsional)
```
