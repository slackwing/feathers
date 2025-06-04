export interface RunResult {
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