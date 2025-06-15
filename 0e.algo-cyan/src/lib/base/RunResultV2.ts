export interface RunResultV2 {
  durationMs: number;
  originalQuote: number;
  finalQuote: number;
  maxNetCapitalExposure: number;
  deltaAccountValue: number;
  isComplete: boolean;
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
  getSignalCount: () => number;
  getAverageTimeBetweenSignals: () => number;
  getStdDeviationTimeBetweenSignals: () => number;
  getOversignalCount: () => number;
  getPresignalCount: () => number;
  getOversignalRatio: () => number;
} 