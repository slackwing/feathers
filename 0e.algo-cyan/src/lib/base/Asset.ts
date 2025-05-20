export enum Asset {
  USD = 'USD',
  BTC = 'BTC',
  ETH = 'ETH'
}

export class AssetPair {
  readonly base: Asset;
  readonly quote: Asset;
  readonly symbol: string;
  constructor(base: Asset, quote: Asset) {
    this.base = base;
    this.quote = quote;
    this.symbol = `${base}-${quote}`;
  }
}

export class Funds {
  readonly asset: Asset;
  readonly amount: number;

  constructor(asset: Asset, amount: number) {
    this.asset = asset;
    this.amount = amount;
  }
}