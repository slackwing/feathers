import { Asset, AssetPair } from "./Asset";
import { Funds } from "./Funds";

export class Quotes {
  private _quotingAsset: Asset;
  private _quotes: Map<Asset, number>;

  constructor(quotingAsset: Asset) {
    this._quotingAsset = quotingAsset;
    this._quotes = new Map<Asset, number>();
  }

  public setQuote(assetPair: AssetPair, quote: number): void {
    if (assetPair.quote !== this._quotingAsset) {
      throw new Error(`Asset pair ${assetPair.base}/${assetPair.quote} is not quoting ${this._quotingAsset}.`);
    }
    this._quotes.set(assetPair.base, quote);
  }

  public getQuote(asset: Asset): number {
    const quote = this._quotes.get(asset);
    if (quote === undefined) {
      throw new Error(`No quote found for asset ${asset}.`);
    }
    return quote;
  }

  public computeValue(funds: Funds): number {
    return Array.from(funds.values()).reduce((total, fund) => {
      if (fund.asset === this._quotingAsset) {
        return total + fund.amount;
      }
      const quote = this._quotes.get(fund.asset);
      if (quote === undefined) {
        throw new Error(`No quote found for asset ${fund.asset}.`);
      }
      return total + fund.amount * quote;
    }, 0);
  }
}