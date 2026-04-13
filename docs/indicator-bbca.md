# Indikator Top-Down: BBCA (Bank Central Asia)

> Sektor: Perbankan | Layer: Makro → Sektoral Perbankan → Emiten BBCA

---

## Layer 1 — Makro

| Kode | Nama Indikator | Unit | Sumber | Frekuensi | Tabel DB |
|---|---|---|---|---|---|
| `BI_RATE` | BI Rate | % | bi.go.id | Bulanan | `macro_indicators` |
| `GDP_GROWTH` | Pertumbuhan GDP Indonesia | % YoY | BPS / FRED | Kuartalan | `macro_indicators` |
| `CPI_ID` | Inflasi CPI Indonesia | % YoY | BPS | Bulanan | `macro_indicators` |
| `IDR_USD` | Kurs Rupiah terhadap USD | IDR | FRED / bi.go.id | Harian | `macro_indicators` |
| `CURRENT_ACCOUNT` | Neraca Transaksi Berjalan | USD Miliar | BI | Kuartalan | `macro_indicators` |

### Cara Baca

```
BI_RATE turun   → cost of fund bank turun → NIM berpotensi melebar  → POSITIF
BI_RATE naik    → cost of fund naik       → tekanan margin           → NEGATIF

GDP_GROWTH > 5% → permintaan kredit ekspansi                        → POSITIF
GDP_GROWTH < 4% → permintaan kredit lesu, risiko NPL naik           → NEGATIF

CPI_ID 2–4%     → inflasi terkontrol, BI tidak perlu naikkan rate   → POSITIF
CPI_ID > 5%     → BI terpaksa naikkan rate → tekanan NIM            → NEGATIF

IDR_USD stabil  → capital inflow terjaga, BI tidak defensif          → POSITIF
IDR_USD melemah → risiko capital outflow → BI naikkan rate defensif  → NEGATIF
```

---

## Layer 2 — Sektoral Perbankan

| Kode | Nama Indikator | Unit | Sumber | Frekuensi | Tabel DB |
|---|---|---|---|---|---|
| `LOAN_GROWTH` | Pertumbuhan kredit industri perbankan | % YoY | OJK SPI | Bulanan | `sectoral_indicators` |
| `NPL_BANKING` | Non Performing Loan rata-rata industri | % | OJK SPI | Bulanan | `sectoral_indicators` |
| `NIM_BANKING` | Net Interest Margin rata-rata industri | % | OJK SPI | Bulanan | `sectoral_indicators` |
| `CAR_BANKING` | Capital Adequacy Ratio rata-rata industri | % | OJK SPI | Bulanan | `sectoral_indicators` |
| `DPK_GROWTH` | Pertumbuhan Dana Pihak Ketiga | % YoY | OJK / BI | Bulanan | `sectoral_indicators` |
| `LDR_BANKING` | Loan to Deposit Ratio industri | % | OJK SPI | Bulanan | `sectoral_indicators` |

### Cara Baca

```
LOAN_GROWTH 8–12%  → ekspansi kredit sehat, revenue industri tumbuh → POSITIF
LOAN_GROWTH < 5%   → permintaan kredit lesu                          → NEGATIF

NPL_BANKING < 3%   → kualitas aset industri sehat                   → POSITIF
NPL_BANKING > 3%   → risiko kredit macet sistemik                   → NEGATIF

NIM_BANKING stabil → profitabilitas industri terjaga                 → POSITIF
NIM_BANKING turun  → kompresi margin, laba industri tertekan         → NEGATIF

CAR_BANKING > 14%  → buffer modal cukup (regulasi minimum 8%)       → POSITIF
CAR saat ini ~25%  → sangat solid, ruang ekspansi kredit luas        → POSITIF

DPK_GROWTH naik    → bahan bakar kredit tersedia                    → POSITIF
```

### URL Sumber OJK SPI

```
https://www.ojk.go.id/id/kanal/perbankan/data-dan-statistik/
statistik-perbankan-indonesia/Default.aspx
```

---

## Layer 3 — Emiten BBCA

| Kode | Nama Indikator | Unit | Sumber | Frekuensi | Tabel DB |
|---|---|---|---|---|---|
| `PRICE_BBCA` | Harga saham BBCA | IDR | IDX / Yahoo Finance | Harian | `emiten_indicators` |
| `CASA_BBCA` | CASA Ratio (Current Account Savings Account) | % | Laporan keuangan IDX | Kuartalan | `emiten_indicators` |
| `NPL_BBCA` | Non Performing Loan BBCA | % | Laporan keuangan IDX | Kuartalan | `emiten_indicators` |
| `NIM_BBCA` | Net Interest Margin BBCA | % | Laporan keuangan IDX | Kuartalan | `emiten_indicators` |
| `ROE_BBCA` | Return on Equity BBCA | % | Laporan keuangan IDX | Kuartalan | `emiten_indicators` |
| `ROA_BBCA` | Return on Assets BBCA | % | Laporan keuangan IDX | Kuartalan | `emiten_indicators` |
| `PBV_BBCA` | Price to Book Value | x | Hitung (PRICE / BV per share) | Harian | `emiten_indicators` |
| `PER_BBCA` | Price to Earnings Ratio | x | Hitung (PRICE / EPS TTM) | Harian | `emiten_indicators` |
| `EPS_BBCA` | Earnings Per Share | IDR | Laporan keuangan IDX | Kuartalan | `emiten_indicators` |
| `NET_PROFIT_BBCA` | Laba bersih | IDR Triliun | Laporan keuangan IDX | Kuartalan | `emiten_indicators` |

### Cara Baca

```
CASA_BBCA > 80%    → moat utama BBCA, cost of fund sangat rendah    → POSITIF
CASA_BBCA turun    → kompetitor merebut dana murah, moat tergerus    → WASPADA

NPL_BBCA < NPL_BANKING → BBCA lebih baik dari rata-rata industri    → POSITIF
NPL_BBCA naik      → kualitas kredit memburuk                       → NEGATIF

NIM_BBCA > 5%      → spread bunga sehat                             → POSITIF
NIM_BBCA < 4%      → margin tertekan                                → NEGATIF

ROE_BBCA ~20%      → jauh di atas rata-rata industri ~15%           → POSITIF
ROE_BBCA turun ke industri → keunggulan kompetitif melemah          → WASPADA

PBV_BBCA 3–4x      → premium wajar mengingat ROE tinggi             → NETRAL
PBV_BBCA > 5x      → valuasi terlalu mahal                          → MAHAL
PBV_BBCA < 3x      → diskon historis, peluang akumulasi             → MURAH
```

### Benchmark BBCA vs Industri

| Indikator | BBCA | Rata-rata Industri | Status |
|---|---|---|---|
| CASA Ratio | ~82% | ~55% | Unggul signifikan |
| NPL | ~1.5% | ~2.4% | Lebih baik |
| NIM | ~5.3% | ~4.2% | Lebih tinggi |
| ROE | ~20% | ~15% | Unggul signifikan |
| CAR | >25% | ~25.8% | Setara industri |

---

## Ringkasan Collector yang Dibutuhkan

| Collector | Indikator yang Diambil | Layer |
|---|---|---|
| `fred.collector` | `IDR_USD` | Makro |
| `bi-rate.collector` | `BI_RATE` | Makro |
| `bps.collector` | `GDP_GROWTH`, `CPI_ID` | Makro |
| `ojk-spi.collector` | `LOAN_GROWTH`, `NPL_BANKING`, `NIM_BANKING`, `CAR_BANKING`, `DPK_GROWTH`, `LDR_BANKING` | Sektoral |
| `idx-price.collector` | `PRICE_BBCA` | Emiten |
| `financial-report.collector` | `CASA_BBCA`, `NPL_BBCA`, `NIM_BBCA`, `ROE_BBCA`, `ROA_BBCA`, `EPS_BBCA`, `NET_PROFIT_BBCA` | Emiten |
