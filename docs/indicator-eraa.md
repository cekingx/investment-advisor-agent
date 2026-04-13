# Indikator Top-Down: ERAA (Erajaya Swasembada)

> Sektor: Ritel Elektronik & Distribusi | Layer: Makro → Sektoral Ritel Teknologi → Emiten ERAA

---

## Layer 1 — Makro

| Kode | Nama Indikator | Unit | Sumber | Frekuensi | Tabel DB |
|---|---|---|---|---|---|
| `IKK` | Indeks Keyakinan Konsumen | Index | BI | Bulanan | `macro_indicators` |
| `IDR_USD` | Kurs Rupiah terhadap USD | IDR | FRED / bi.go.id | Harian | `macro_indicators` |
| `CPI_ID` | Inflasi CPI Indonesia | % YoY | BPS | Bulanan | `macro_indicators` |
| `GDP_GROWTH` | Pertumbuhan GDP Indonesia | % YoY | BPS / FRED | Kuartalan | `macro_indicators` |
| `HOUSEHOLD_CONSUMPTION` | Pertumbuhan konsumsi rumah tangga | % YoY | BPS | Kuartalan | `macro_indicators` |
| `BI_RATE` | BI Rate | % | bi.go.id | Bulanan | `macro_indicators` |

### Cara Baca

```
IKK > 100        → konsumen optimis → belanja gadget naik           → POSITIF
IKK < 100        → konsumen pesimis → pembelian gadget ditunda      → NEGATIF
IKK turun 3 bln berturut-turut → tren pelemahan daya beli          → WASPADA

IDR_USD stabil   → harga impor gadget stabil, margin ERAA terjaga  → POSITIF
IDR_USD melemah  → COGS naik (semua produk diimpor dalam USD)
                   ERAA harus naikkan harga atau terima margin tipis → NEGATIF
IDR melemah 10%  → tekanan COGS ~10%, net margin bisa terpangkas    → KRITIS

CPI_ID 2–4%      → daya beli riil terjaga                          → POSITIF
CPI_ID > 5%      → erosi daya beli, orang tahan beli gadget baru   → NEGATIF

HOUSEHOLD_CONSUMPTION > 5% → belanja RT kuat, pasar gadget tumbuh  → POSITIF
HOUSEHOLD_CONSUMPTION < 4% → konsumsi lesu                         → NEGATIF

BI_RATE naik     → beban bunga utang bank ERAA naik (utang ~Rp5T)  → NEGATIF
BI_RATE turun    → beban bunga berkurang, laba bersih terdongkrak  → POSITIF
```

> **Catatan khusus ERAA:** Kurs IDR/USD adalah indikator makro paling kritikal
> untuk ERAA — lebih dari BI Rate. Hampir semua produk (Apple, Samsung, dll)
> diimpor dalam USD. Pelemahan rupiah langsung menghantam COGS.

---

## Layer 2 — Sektoral Ritel Teknologi

| Kode | Nama Indikator | Unit | Sumber | Frekuensi | Tabel DB |
|---|---|---|---|---|---|
| `IPR_RETAIL` | Indeks Penjualan Riil | Index | BPS | Bulanan | `sectoral_indicators` |
| `SMARTPHONE_SHIPMENT` | Shipment smartphone Indonesia | Juta unit | IDC / APSI | Kuartalan | `sectoral_indicators` |
| `RETAIL_SALES_GROWTH` | Pertumbuhan penjualan ritel nasional | % YoY | BPS / BI | Bulanan | `sectoral_indicators` |
| `ECOMMERCE_GMV` | GMV e-commerce Indonesia | USD Miliar | Laporan industri | Tahunan | `sectoral_indicators` |

### Cara Baca

```
IPR_RETAIL naik YoY   → volume belanja ritel fisik meningkat       → POSITIF
IPR_RETAIL turun      → konsumen beralih online atau tahan belanja  → NEGATIF

SMARTPHONE_SHIPMENT naik → pasar tumbuh, volume ERAA berpotensi naik
                           ERAA >50% market share distribusi handset → POSITIF
SMARTPHONE_SHIPMENT flat → pasar jenuh atau daya beli lemah         → NETRAL
SMARTPHONE_SHIPMENT turun → demand gadget melemah                   → NEGATIF

RETAIL_SALES_GROWTH > 5% → momentum belanja konsumen kuat          → POSITIF
RETAIL_SALES_GROWTH < 2% → konsumsi ritel lesu                     → NEGATIF
```

### Faktor Sektoral Khusus ERAA (Non-Kuantitatif)

Indikator berikut tidak tersedia sebagai data time-series otomatis, namun wajib dipantau secara manual karena dampaknya sangat signifikan terhadap revenue ERAA:

| Faktor | Cara Pantau | Dampak |
|---|---|---|
| **Siklus produk iPhone** | Pantau jadwal rilis Apple (Sept–Okt tiap tahun) | iPhone baru = lonjakan penjualan 1–2 kuartal |
| **Kebijakan TKDN Apple** | Pantau pengumuman Kemenperin | TKDN belum terbit = iPhone tertahan, revenue delay |
| **Kebijakan TKDN Android** | Pantau Kemenperin untuk Samsung, Xiaomi | Sama seperti Apple |
| **Ekspansi e-commerce** | Pantau strategi Tokopedia, Shopee di kategori gadget | Ancaman market share offline ERAA |

```
URL pantau TKDN:
https://www.kemenperin.go.id
```

---

## Layer 3 — Emiten ERAA

| Kode | Nama Indikator | Unit | Sumber | Frekuensi | Tabel DB |
|---|---|---|---|---|---|
| `PRICE_ERAA` | Harga saham ERAA | IDR | IDX / Yahoo Finance | Harian | `emiten_indicators` |
| `SSSG_ERAA` | Same Store Sales Growth | % YoY | Keterbukaan informasi IDX | Bulanan | `emiten_indicators` |
| `STORE_COUNT_ERAA` | Jumlah gerai aktif | Gerai | Keterbukaan informasi IDX | Bulanan | `emiten_indicators` |
| `REVENUE_ERAA` | Penjualan bersih | IDR Triliun | Laporan keuangan IDX | Kuartalan | `emiten_indicators` |
| `GROSS_MARGIN_ERAA` | Gross Profit Margin | % | Laporan keuangan IDX | Kuartalan | `emiten_indicators` |
| `NET_MARGIN_ERAA` | Net Profit Margin | % | Laporan keuangan IDX | Kuartalan | `emiten_indicators` |
| `NET_PROFIT_ERAA` | Laba bersih | IDR Miliar | Laporan keuangan IDX | Kuartalan | `emiten_indicators` |
| `DAYS_INVENTORY_ERAA` | Days Inventory Outstanding | Hari | Hitung dari lapkeu | Kuartalan | `emiten_indicators` |
| `SHORT_TERM_DEBT_ERAA` | Utang bank jangka pendek | IDR Triliun | Laporan keuangan IDX | Kuartalan | `emiten_indicators` |
| `PER_ERAA` | Price to Earnings Ratio | x | Hitung (PRICE / EPS TTM) | Harian | `emiten_indicators` |
| `PBV_ERAA` | Price to Book Value | x | Hitung (PRICE / BV per share) | Harian | `emiten_indicators` |
| `EPS_ERAA` | Earnings Per Share | IDR | Laporan keuangan IDX | Kuartalan | `emiten_indicators` |

### Cara Baca

```
SSSG_ERAA > 0%      → bisnis inti sehat, toko lama tumbuh          → POSITIF
SSSG_ERAA < 0%      → penurunan organik, bukan sekadar ekspansi    → NEGATIF
SSSG naik tapi revenue flat → ekspansi toko menutupi penurunan organik → WASPADA

STORE_COUNT naik    → ekspansi jangka panjang, short-term tekan profit → NETRAL
Net store opening   → hitung (toko buka - toko tutup) per periode
Banyak penutupan toko → optimasi atau bisnis sedang konsolidasi    → WASPADA

GROSS_MARGIN > 11%  → efisiensi pengadaan & pricing terjaga        → POSITIF
GROSS_MARGIN < 10%  → tekanan COGS (kurs / kompetisi harga)        → NEGATIF

NET_MARGIN ~1.6%    → normal untuk bisnis distribusi, tipis         → NETRAL
NET_MARGIN < 1%     → sudah sangat tertekan, waspada arus kas       → NEGATIF

DAYS_INVENTORY < 50 hari → perputaran stok sehat                   → POSITIF
DAYS_INVENTORY > 60 hari → stok menumpuk, risiko keusangan gadget  → NEGATIF
DAYS_INVENTORY 2025: 62.2 hari → perlu dimonitor ketat             → WASPADA

SHORT_TERM_DEBT naik → beban bunga naik, terutama jika BI Rate tinggi → WASPADA
SHORT_TERM_DEBT 2025: ~Rp5T → beban bunga Rp641M, tekan net margin → PERHATIAN

PER_ERAA ~5x        → sangat murah secara historis                  → MURAH
PBV_ERAA < 1x       → di bawah nilai buku, value opportunity        → MURAH
```

### Formula Perhitungan Indikator Turunan

```
DAYS_INVENTORY = (Persediaan / HPP) × jumlah_hari_periode

Contoh Q4 2025:
  Persediaan    = Rp8.2 triliun
  HPP           = Rp68.26 triliun / 365 = Rp186.9 miliar/hari
  Days Inventory = 8.200 / 186.9 = 43.9 hari
```

### Segmentasi Revenue ERAA (untuk validasi data)

```
Revenue FY2025: Rp76.6 triliun
  ├── Telepon selular & tablet  : Rp60.07T  (~78%)  ← driver utama
  ├── Aksesoris & lainnya       : Rp11.92T  (~16%)
  ├── Komputer & elektronik     : Rp3.05T   (~4%)
  └── Produk operator           : Rp1.55T   (~2%)

Implikasi: Jika iPhone/flagship Android terlambat masuk Indonesia
→ segmen 78% revenue langsung terdampak
```

---

## Ringkasan Collector yang Dibutuhkan

| Collector | Indikator yang Diambil | Layer |
|---|---|---|
| `ikk.collector` | `IKK` | Makro |
| `fred.collector` | `IDR_USD` | Makro |
| `bps.collector` | `CPI_ID`, `GDP_GROWTH`, `HOUSEHOLD_CONSUMPTION` | Makro |
| `bi-rate.collector` | `BI_RATE` | Makro |
| `ipr.collector` | `IPR_RETAIL`, `RETAIL_SALES_GROWTH` | Sektoral |
| `idx-price.collector` | `PRICE_ERAA` | Emiten |
| `financial-report.collector` | `REVENUE_ERAA`, `GROSS_MARGIN_ERAA`, `NET_MARGIN_ERAA`, `NET_PROFIT_ERAA`, `SHORT_TERM_DEBT_ERAA`, `EPS_ERAA` | Emiten |
| `keterbukaan.collector` | `SSSG_ERAA`, `STORE_COUNT_ERAA` | Emiten |
