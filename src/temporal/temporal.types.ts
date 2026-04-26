export interface IndicatorRecord {
  code: string;
  value: number;
  unit: string | null;
  periodDate: string; // ISO date string — safe across Temporal JSON serialization
}

export interface SectoralIndicatorRecord extends IndicatorRecord {
  sector: string;
}

export interface StockIndicatorRecord extends IndicatorRecord {
  ticker: string;
}

export interface IndicatorSnapshot {
  macro: IndicatorRecord[];
  sectoral: SectoralIndicatorRecord[];
  stock: StockIndicatorRecord[];
}

// Activity interfaces — used in proxyActivities<T>() inside workflow files
export interface CollectActivities {
  collectBiRate(): Promise<void>;
  collectFred(): Promise<void>;
  collectIdxPrices(): Promise<void>;
  fetchSubscribedUsers(): Promise<number[]>;
}

export interface AnalyzeActivities {
  fetchLatestIndicators(): Promise<IndicatorSnapshot>;
  analyzeStocks(chatId: number, snapshot: IndicatorSnapshot): Promise<string>;
}

export interface SendActivities {
  sendTelegramMessage(chatId: number, text: string): Promise<void>;
  sendErrorNotification(chatId: number, error: string): Promise<void>;
}
