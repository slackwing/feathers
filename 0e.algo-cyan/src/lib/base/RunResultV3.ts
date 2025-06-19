export interface RunResultV2 {
  durationMs: number;
  originalQuote: number;
  finalQuote: number; // updates
  maxNetCapitalExposure: number; // updates
  deltaAccountValue: number; // updates
  isComplete: boolean; // updates
  startTime: number;
  stochasticParams: {
    kPeriod: number;
    dPeriod: number;
    slowingPeriod: number;
  };
  strategyParams: {
    threshold: number;
  };
  timeBetweenSignals: number[];
  intelCounts: Map<string, number>;
  orderSummaries: string[];
  getSignalCount: () => number;
  getAverageTimeBetweenSignals: () => number;
  getStdDeviationTimeBetweenSignals: () => number;
  getOversignalCount: () => number;
  getPresignalCount: () => number;
  getOversignalRatio: () => number;
} 