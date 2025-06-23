import { Order } from '@/lib/base/Order';
import { OrderBook } from '@/lib/base/OrderBook';
import { PubSub, ReadOnlyPubSub } from '@/lib/infra/PubSub';
import { Trade } from '@/lib/base/Trade';
import { BatchedPubSub } from '../infra/BatchedPubSub';
import { AssetPair } from './Asset';

export class VirtualExchange<A extends AssetPair> {

  readonly assetPair: A;
  private readonly _combinedOrderBook: OrderBook<A>;
  private readonly _combinedOrderFeed: PubSub<Order<A>>;
  private readonly _combinedTradeFeed: PubSub<Trade<A>>;

  constructor(assetPair: A) {
    this.assetPair = assetPair;
    this._combinedOrderBook = new OrderBook<A>(assetPair);
    this._combinedOrderFeed = new PubSub<Order<A>>();
    this._combinedTradeFeed = new PubSub<Trade<A>>();
  }

  public get combinedOrderBook(): OrderBook<A> { return this._combinedOrderBook; }
  public get combinedOrderFeed(): ReadOnlyPubSub<Order<A>> { return this._combinedOrderFeed; }
  public get combinedTradeFeed(): ReadOnlyPubSub<Trade<A>> { return this._combinedTradeFeed; }

  public ingestOrderFeed(orderFeed: ReadOnlyPubSub<Order<A>>): void {
    // Intentional order of operations.
    this._combinedOrderBook.ingestOrderFeed(orderFeed);
    orderFeed.subscribe(this.onOrder);
    orderFeed.subscribe(this._combinedOrderFeed.publish);
  }

  public ingestTradeFeed(tradeFeed: ReadOnlyPubSub<Trade<A>>): void {
    // Intentional order of operations.
    tradeFeed.subscribe(this.onTrade);
    tradeFeed.subscribe(this._combinedTradeFeed.publish);
  }

  public ingestBatchedTradeFeed(batchedTradeFeed: BatchedPubSub<Trade<A>>): void {
    // Intentional order of operations.
    batchedTradeFeed.subscribe(this.onTradeBatch);
    batchedTradeFeed.subscribe(
      (trades) => trades.forEach((trade) => this._combinedTradeFeed.publish(trade))
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onOrder(order: Order<A>): void {
    // Does nothing. Override in subclass.
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
    // Override in subclass.
  }
}
