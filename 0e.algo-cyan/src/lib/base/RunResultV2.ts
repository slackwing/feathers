export interface RunResultV2 {
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
} 