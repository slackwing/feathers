import { Order } from '@/lib/base/Order';
import { OrderBook } from '@/lib/base/OrderBook';
import { ReadOnlyPubSub } from '@/lib/infra/PubSub';
import { Trade } from '@/lib/base/Trade';
import { BatchedPubSub } from '../infra/BatchedPubSub';
import { AssetPair } from './Asset';

export class SingleAssetWorld<A extends AssetPair> {

  readonly assetPair: A;
  public combinedBook: OrderBook<A>;

  constructor(assetPair: A) {
    this.assetPair = assetPair;
    this.combinedBook = new OrderBook<A>(assetPair);
  }

  public subscribeToOrderFeed(orderFeed: ReadOnlyPubSub<Order<A>>): void {
    this.combinedBook.subscribe(orderFeed);
  }

  public subscribeToTradeFeed(tradeFeed: ReadOnlyPubSub<Trade<A>>): void {
    tradeFeed.subscribe(this.onTrade);
  }

  public subscribeToBatchedTradeFeed(batchedTradeFeed: BatchedPubSub<Trade<A>>): void {
    batchedTradeFeed.subscribe(this.onTradeBatch);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onTrade(trade: Trade<A>): void {
    // Does nothing. Override in subclass.
  }

  // Some world models may depend on batches of trades to infer specific
  // information, e.g. a single taker across multiple price levels. By
  // default, simply forwards to onTrade() for each trade.
  protected onTradeBatch(trades: Trade<A>[]): void {
    trades.forEach((trade) => this.onTrade(trade));
  }
}
