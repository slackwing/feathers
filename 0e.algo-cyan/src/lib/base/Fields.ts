export class OHLC {
  constructor(public readonly o: number, public readonly h: number, public readonly l: number, public readonly c: number) {}
}

export class Stochastics {
  constructor(public readonly fastK: number, public readonly fastD: number, public readonly slowD: number) {}
}