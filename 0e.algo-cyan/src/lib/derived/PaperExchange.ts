import { ExchangeType, Order, OrderType, Side } from '../base/Order';
import { PubSub, ReadOnlyPubSub } from '../infra/PubSub';
import { VirtualExchange } from '../base/VirtualExchange';
import { AssetPair } from '../base/Asset';
import { Execution, ExecutionStatus } from '../base/Execution';
import assert from 'assert';
import { eq, gte, lte } from '../utils/number';
import { Trade } from '../base/Trade';

export class PaperExchange<A extends AssetPair> extends VirtualExchange<A> {
  public readonly paperFeed: PubSub<Order<A>>;
  private readonly _executionFeed: PubSub<Execution<A>>;
  private readonly _tradeFeed: PubSub<Trade<A>>;

  constructor(
    assetPair: A,
    orderFeed: ReadOnlyPubSub<Order<A>>,
    tradeFeed: ReadOnlyPubSub<Trade<A>>,
    paperFeed: PubSub<Order<A>>
  ) {
    super(assetPair);
    this.paperFeed = paperFeed;
    this._executionFeed = new PubSub<Execution<A>>();
    this._tradeFeed = new PubSub<Trade<A>>();
    this.ingestOrderFeed(orderFeed);
    this.ingestTradeFeed(tradeFeed);
    this.ingestOrderFeed(paperFeed);
    this.ingestTradeFeed(this._tradeFeed);
  }

  public get executionFeed(): ReadOnlyPubSub<Execution<A>> { return this._executionFeed; }

  protected onOrder = (newOrder: Order<A>): void => {
    // We are only interested in matching paper orders.
    if (newOrder.type !== OrderType.PAPER) {
      return;
    }
    const oppositeBook = newOrder.side === Side.BUY ? this.combinedOrderBook.asks : this.combinedOrderBook.bids;
    // This is relative to the order's opposing side.
    const insideOrEqual = (a: number, b: number) => (newOrder.side === Side.BUY ? lte(a, b) : gte(a, b));
    const limitPrice = newOrder.exchangeType == ExchangeType.LIMIT ? newOrder.price : null;
    const it = oppositeBook[Symbol.iterator]();
    let next = it.next();
    while (!next.done && (limitPrice == null || insideOrEqual(next.value.price, limitPrice))) {
      try {
        if (lte(newOrder.remainingQty, 0)) {
          break;
        }
        const existingOrder = next.value;
        if (lte(existingOrder.remainingQty, 0)) {
          console.warn("WARNING: OrderBook had an order with 0.0 remainingQty; skipping gracefully.");
          next = it.next();
          continue;
        }
        if (existingOrder.type === OrderType.PAPER) {
          // Self trade case. Mutually cancel the minimum of the two orders' remaining quantities.
          const cancellationQty = Math.min(newOrder.remainingQty, existingOrder.remainingQty);
          newOrder.cancel(cancellationQty);
          existingOrder.cancel(cancellationQty);
        } else {
          const originalQty = newOrder.remainingQty;
          const executionQty = Math.min(newOrder.remainingQty, existingOrder.remainingQty);
          const execution = new Execution<A>(
            this.assetPair,
            newOrder,
            existingOrder,
            existingOrder.price,
            executionQty,
            Date.now()
          );
          execution.execute();
          if (execution.status === ExecutionStatus.COMPLETED) {
            this._executionFeed.publish(execution);
            this._tradeFeed.publish(new Trade<A>(
              this.assetPair,
              execution.buyOrder.side,
              execution.executionPrice,
              execution.executionQty,
              execution.timestamp
            ));
            this._tradeFeed.publish(new Trade<A>(
              this.assetPair,
              execution.sellOrder.side,
              execution.executionPrice,
              execution.executionQty,
              execution.timestamp
            ));
          } else {
            throw new Error('ASSERT: Execution should have been completed.'); // TODO(P1): Haven't thought what to do here.
          }
          assert.ok(eq(newOrder.remainingQty, originalQty - executionQty), 'IMPOSSIBLE: Order remaining quantity should have decreased by execution quantity.');
        }
      } catch (e) {
        // Quit matching but don't fail the entire source operation.
        console.warn("WARNING: Unexpected failure during order matching; failing gracefully.");
        console.error(e);
        // Only allow the order to remain booked if it won't cross the inside.
        if (limitPrice == null || insideOrEqual(limitPrice, next.value.price)) {
          console.warn("WARNING: Cancelling remainder of order.");
          newOrder.cancel(newOrder.remainingQty);
        }
        break;
      }
      next = it.next();
    }
  }
}
