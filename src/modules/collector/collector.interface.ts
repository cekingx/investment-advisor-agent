export interface IndicatorPayload {
  code: string;
  value: number;
  unit: string;
  periodDate: Date;
}

export interface ICollector {
  readonly indicatorCode: string;
  readonly layer: 'macro' | 'sectoral' | 'stock';
  readonly source: string;
  collect(): Promise<IndicatorPayload[]>;
}
