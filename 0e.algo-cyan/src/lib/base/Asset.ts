export enum Asset {
  USD = 'USD',
  BTC = 'BTC'
}

export class AssetPair {
  readonly base: Asset;
  readonly quote: Asset;

  constructor(base: Asset, quote: Asset) {
    this.base = base;
    this.quote = quote;
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