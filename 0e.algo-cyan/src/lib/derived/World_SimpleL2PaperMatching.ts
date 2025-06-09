import { L2OrderBook } from './L2OrderBook';
import { ExchangeType, Order, OrderType, Side } from '../base/Order';
import { OrderBook } from '../base/OrderBook';
import { PubSub } from '../infra/PubSub';
import { World_SingleAsset } from '../base/World_SingleAsset';
import { AssetPair } from '../base/Asset';
import { Execution, ExecutionStatus } from '../base/Execution';
import assert from 'assert';
import { eq, gte, lte } from '../utils/number';

export class World_SimpleL2PaperMatching<A extends AssetPair> extends World_SingleAsset<A> {
  protected l2book: L2OrderBook<A>;
  protected paperBook: OrderBook<A>;
  public paperFeed: PubSub<Order<A>>;
  public executionFeed: PubSub<Execution<A>>;

  constructor(assetPair: A, l2OrderBook: L2OrderBook<A>, paperFeed: PubSub<Order<A>>) {
    super(assetPair);
    this.l2book = l2OrderBook;
    this.paperBook = new OrderBook<A>(assetPair);
    this.paperFeed = paperFeed;
    this.executionFeed = new PubSub<Execution<A>>();
    this.subscribeToOrderFeed(l2OrderBook.singleSource);
    this.subscribeToOrderFeed(paperFeed);
  }

  protected onOrder = (newOrder: Order<A>): void => {
    // We are only interested in matching paper orders.
    if (newOrder.type !== OrderType.PAPER) {
      return;
    }
    const oppositeBook = newOrder.side === Side.BUY ? this.combinedBook.asks : this.combinedBook.bids;
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
        if (existingOrder.type === OrderType.L2) {
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
            this.executionFeed.publish(execution);
          } else {
            throw new Error('ASSERT: Execution should have been completed.'); // TODO(P1): Haven't thought what to do here.
          }
          assert.ok(eq(newOrder.remainingQty, originalQty - executionQty), 'IMPOSSIBLE: Order remaining quantity should have decreased by execution quantity.');
        } else if (existingOrder.type === OrderType.PAPER) {
          // Self trade case. Mutually cancel the minimum of the two orders' remaining quantities.
          const cancellationQty = Math.min(newOrder.remainingQty, existingOrder.remainingQty);
          newOrder.cancel(cancellationQty);
          existingOrder.cancel(cancellationQty);
        } else {
          assert.ok(false, 'IMPOSSIBLE: Unhandled opposing order type during order matching.');
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
