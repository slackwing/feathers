import { Order } from '@/lib/base/Order';
import { OrderBook } from '@/lib/base/OrderBook';
import { PubSub } from '@/lib/infra/PubSub';
import { Trade } from '@/lib/base/Trade';
import { BatchedPubSub } from '../infra/BatchedPubSub';
import { AssetPair } from './Asset';

export class SingleAssetWorld<T extends AssetPair> {

  readonly assetPair: T;
  public combinedBook: OrderBook<T>;

  constructor(assetPair: T) {
    this.assetPair = assetPair;
    this.combinedBook = new OrderBook<T>(assetPair);
  }

  public subscribeToOrderFeed(orderFeed: PubSub<Order<T>>): void {
    this.combinedBook.subscribe(orderFeed);
  }

  public subscribeToTradeFeed(tradeFeed: PubSub<Trade>): void {
    tradeFeed.subscribe(this.onTrade);
  }

  public subscribeToBatchedTradeFeed(batchedTradeFeed: BatchedPubSub<Trade>): void {
    batchedTradeFeed.subscribe(this.onTradeBatch);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onTrade(trade: Trade): void {
    // Does nothing. Override in subclass.
  }

  // Some world models may depend on batches of trades to infer specific
  // information, e.g. a single taker across multiple price levels. By
  // default, simply forwards to onTrade() for each trade.
  protected onTradeBatch(trades: Trade[]): void {
    trades.forEach((trade) => this.onTrade(trade));
  }
}
