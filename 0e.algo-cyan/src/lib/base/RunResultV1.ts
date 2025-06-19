export interface RunResultV1 {
  originalQuote: number;
  finalQuote: number;
  baseValue: number;
  deltaValue: number;
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