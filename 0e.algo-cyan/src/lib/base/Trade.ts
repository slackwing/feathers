import { AssetPair } from './Asset';
import { Side } from './Order';

export function getBatchingFn() {
  let prevTimestamp: number | null = null;
  let prevPrice: number | null = null;
  let prevSide: Side | null = null;
  return (trade: Trade<AssetPair>) => {
    const timestampChanged = prevTimestamp !== null && trade.timestamp !== prevTimestamp;
    const movingInward = prevPrice !== null && (
      trade.side === Side.BUY ? trade.price > prevPrice : trade.price < prevPrice
    );
    const sideChanged = prevSide !== null && trade.side !== prevSide;
    const shouldPublish = timestampChanged || movingInward || sideChanged;
    prevTimestamp = trade.timestamp;
    prevPrice = trade.price;
    prevSide = trade.side;
    return shouldPublish;
  };
}

export class Trade<T extends AssetPair> {
  constructor(
    public readonly assetPair: T,
    public readonly side: Side,
    public readonly price: number,
    public readonly quantity: number,
    public readonly timestamp: number
  ) {}
}
