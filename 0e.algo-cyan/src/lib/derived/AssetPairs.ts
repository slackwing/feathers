import { Asset, AssetPair } from "../base/Asset";

export class BTCUSD extends AssetPair {
  constructor() {
    super(Asset.BTC, Asset.USD);
  }
}

export const BTCUSD_ = new BTCUSD();

export class ETHUSD extends AssetPair {
  constructor() {
    super(Asset.ETH, Asset.USD);
  }
}

export const ASSET_PAIR_ETHUSD = new ETHUSD();
