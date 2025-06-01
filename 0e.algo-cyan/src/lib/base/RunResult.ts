export interface RunResult {
  initialValue: number;
  currentValue: number;
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