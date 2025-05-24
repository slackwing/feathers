export enum TimeUnit {
  SECOND = 'SECOND',
  MINUTE = 'MINUTE',
  HOUR = 'HOUR',
  DAY = 'DAY',
}

export function toMilliseconds(interval: Interval): number {
  const msPerUnit = {
    [TimeUnit.SECOND]: 1000,
    [TimeUnit.MINUTE]: 60 * 1000,
    [TimeUnit.HOUR]: 60 * 60 * 1000,
    [TimeUnit.DAY]: 24 * 60 * 60 * 1000,
  };
  return interval.duration * msPerUnit[interval.unit];
}

export class Interval {
  constructor(
    public readonly duration: number,
    public readonly unit: TimeUnit,
    public readonly quantized: boolean = false,
  ) {}
}