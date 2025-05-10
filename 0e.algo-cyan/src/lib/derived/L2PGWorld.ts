import { L2OrderBook } from './L2OrderBook';
import { BookType, Order, Side } from '../base/Order';
import { OrderBook } from '../base/OrderBook';
import { PubSub } from '../infra/PubSub';
import { Trade } from '../base/Trade';
import { World } from '../base/World';
import { BatchedPubSub } from '../base/BatchedPubSub';
import * as assert from 'assert';

enum ReluctanceFactor {
  RELUCTANT,
  AGGRESSIVE_BOUNDED,
  AGGRESSIVE_LIMITED,
  MIDPOINT_BOUNDED,
  MIDPOINT_LIMITED,
}

const ABSOLUTE_PRIORITY_TIMESTAMP = 0;

export class L2PGWorld extends World {
  private l2: L2OrderBook;
  private paper: OrderBook;
  private ghost: OrderBook;
  private ghostFeed: PubSub<Order>;
  private reluctanceFactorSupplier: () => ReluctanceFactor;
  private impedimentFactorSupplier: () => number;
  constructor(
    l2OrderBook: L2OrderBook,
    paperFeed: PubSub<Order>,
    batchedTradeFeed: BatchedPubSub<Trade>,
    reluctanceFactorSupplier: () => ReluctanceFactor,
    impedimentFactorSupplier: () => number
  ) {
    super();
    this.l2 = l2OrderBook;
    this.paper = new OrderBook(paperFeed);
    this.ghostFeed = new PubSub<Order>();
    this.ghost = new OrderBook(this.ghostFeed);
    this.reluctanceFactorSupplier = reluctanceFactorSupplier;
    this.impedimentFactorSupplier = impedimentFactorSupplier;
    this.subscribeToOrderFeed(l2OrderBook.singleSource);
    this.subscribeToOrderFeed(paperFeed);
    this.subscribeToOrderFeed(this.ghostFeed);
    this.subscribeToBatchedTradeFeed(batchedTradeFeed);
    assert.ok(
      batchedTradeFeed.getMaxTimeout() === 0,
      'ASSERT: Expected batched trade feed with max timeout of 0.'
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onTrade(trade: Trade): void {
    // The L2PGWorld model relies on batches of trades to infer multi-level price-taking.
  }

  protected onTradeBatch(trades: Trade[]): void {
    const reluctanceFactor = this.reluctanceFactorSupplier();
    const impedimentFactor = this.impedimentFactorSupplier();
    assert.ok(
      impedimentFactor >= 0 && impedimentFactor <= 1,
      'ASSERT: Expected impediment factor to be between 0 and 1.'
    );
    assert.ok(
      reluctanceFactor >= 0 && reluctanceFactor <= 1,
      'ASSERT: Expected reluctance factor to be between 0 and 1.'
    );
    assert.ok(
      reluctanceFactor === ReluctanceFactor.AGGRESSIVE_LIMITED ||
        reluctanceFactor === ReluctanceFactor.RELUCTANT,
      'ASSERT: Currently only supporting RELUCTANT or AGGRESSIVE_LIMITED.'
    );

    // console.log(trades);
    const side = trades[0].side;
    const inside = (a: number, b: number) => (side === Side.BUY ? a > b : a < b);
    const insideOrEqual = (a: number, b: number) => (side === Side.BUY ? a >= b : a <= b);
    const outsideOrEqual = (a: number, b: number) => (side === Side.BUY ? a <= b : a >= b);
    let previousPrice = null;
    let totalTradeQty = 0;
    for (const trade of trades) {
      assert.ok(trade.side === side, 'ASSERT: Expected all trades in batch to be on same side.');
      if (previousPrice === null) {
        previousPrice = trade.price;
      } else {
        assert.ok(
          outsideOrEqual(trade.price, previousPrice),
          'ASSERT: Expected all trades in a batch to be moving outward.'
        );
      }
      totalTradeQty += trade.quantity;
    }
    assert.ok(
      previousPrice !== null,
      'NEVER: Previous price should have been set by any trade in batch.'
    );
    const outsideTradePrice = previousPrice;
    const orders =
      side === Side.BUY
        ? this.combinedBook.getBidsUntil(outsideTradePrice)
        : this.combinedBook.getAsksUntil(outsideTradePrice);

    const tradeIt = trades[Symbol.iterator]();
    const orderIt = orders[Symbol.iterator]();
    let nextTrade = tradeIt.next();
    let nextOrder = orderIt.next();

    if (reluctanceFactor === ReluctanceFactor.AGGRESSIVE_LIMITED) {

      // NOTE: Check insideOrEqual() because once supporting AGGRESSIVE_BOUNDED there will be orders even farther out.
      while (!nextOrder.done && insideOrEqual(nextOrder.value.price, outsideTradePrice)) {
        const order = nextOrder.value;
        if (order.bookType === BookType.PAPER || order.bookType === BookType.GHOST) {
          // TODO(P0): Execute the order.
        }
        nextOrder = orderIt.next();
      }
      // No ghost orders created.

    } else {

      // Orders fully crossed by each trade definitely would have been executed.
      let remainingQty = totalTradeQty;
      while (remainingQty > 0 && !nextTrade.done) {
        const trade = nextTrade.value;
        while (remainingQty > 0 && !nextOrder.done && inside(nextOrder.value.price, trade.price)) {
          const order = nextOrder.value;
          if (order.bookType === BookType.PAPER || order.bookType === BookType.GHOST) {
            const executingQty = Math.min(remainingQty, order.remainingQty);
            // TODO(P0): Execute the order.
            remainingQty -= executingQty;
            if (remainingQty <= 0 && order.remainingQty > 0) {
              // Necessary to prevent advancing to next order while this still has quantity.
              break;
            }
          }
          nextOrder = orderIt.next();
        }
        nextTrade = tradeIt.next();
      }

      if (remainingQty <= 0) {

        // If all trade quantity exhausted before even reaching outside trade price, create ghost
        // orders to compensate quantity of remaining trades at each price level. Any of these
        // price levels may have pre-existing hypothetical orders whose time priority with respect
        // to the compensated L2 quantity is unclear. Therefore, use the impediment factor to
        // prioritize a portion of the ghost orders, i.e. higher impediment translating to more
        // prioritized ghost quantity.
        // BUG: Is there a partial trade quantity case?
        while (!nextTrade.done) {
          const trade = nextTrade.value;
          const prioritizedGhostQty = trade.quantity * (1 - impedimentFactor);
          const normalGhostQty = trade.quantity - prioritizedGhostQty;
          // TODO(P0): Create ghost orders.
          nextTrade = tradeIt.next();
        }

      } else {

        // As long as remainingQty > 0, we would have finished iterating through all trades, and
        // executed hypothetical orders up to the first order matching the outside trade price.
        // Now execute the remaining quantity against prioritized hypothetical orders at this
        // outside trade price. That is, for sure the hypothetical orders that were prioritized
        // to begin with (since they've "always existed" at that time priority), and then a
        // portion of the remaining hypothetical orders whose time priority with respect to the
        // traded L2 quantity is unclear (so we'll use the impediment factor again).

        while (
          remainingQty > 0 &&
          !nextOrder.done &&
          insideOrEqual(nextOrder.value.price, outsideTradePrice) &&
          nextOrder.value.timestamp != ABSOLUTE_PRIORITY_TIMESTAMP
        ) {
          const order = nextOrder.value;
          if (order.bookType === BookType.PAPER || order.bookType === BookType.GHOST) {
            const executingQty = Math.min(remainingQty, order.remainingQty);
            // TODO(P0): Execute the order.
            remainingQty -= executingQty;
            if (remainingQty <= 0 && order.remainingQty > 0) {
              // Necessary to prevent advancing to next order while this still has quantity.
              break;
            }
          }
          nextOrder = orderIt.next();
        }

        let prioritizedRemQty = remainingQty * (1 - impedimentFactor);

        while (
          prioritizedRemQty > 0 &&
          !nextOrder.done &&
          insideOrEqual(nextOrder.value.price, outsideTradePrice)
        ) {
          const order = nextOrder.value;
          if (order.bookType === BookType.PAPER || order.bookType === BookType.GHOST) {
            const executingQty = Math.min(prioritizedRemQty, order.remainingQty);
            // TODO(P0): Execute the order.
            remainingQty -= executingQty;
            prioritizedRemQty -= executingQty;
            if (prioritizedRemQty <= 0 && order.remainingQty > 0) {
              // Necessary to prevent advancing to next order while this still has quantity.
              break;
            }
          }
          nextOrder = orderIt.next();
        }

        // BUG: Something feels off here. Think about the generalized formula.
        if (prioritizedRemQty > 0) {

          // If prioritized quantity still remains at this point, then none of the L2 was reached,
          // so the entirety of the total traded quantity should be compensated with ghost orders
          // at the highest priority.
          // TODO(P0): Create absolute priority ghost order for totalTradeQty.

        } else {

          // If prioritized quantity is exhausted at this point, then remainingQty represents the
          // quantity of the L2 that would have executed even despite all of the impediments. This
          // L2 is by definition higher priority than the remaining hypothetical orders (that's why
          // we split them up in the first place), so the ghost order we create should be created at
          // the highest priority.
          // TODO(P0): Create absolute priority ghost order for totalTradeQty - remainingQty.

          // Note: This case may be possible to merge with the other using a general formula, but
          // Note: maybe keep them separate for clarity.
        }
          

          




        const executedCrossedQty = totalTradeQty - remainingQty;

      }

      let prioritizedRemainingQty = remainingQty * this.impedimentFactor;
      remainingQty -= prioritizedRemainingQty;
      while (
        prioritizedRemainingQty > 0 &&
        !nextOrder.done &&
        insideOrEqual(nextOrder.value.price, trade.price)
      ) {
        const order = nextOrder.value;
        if (order.bookType === BookType.PAPER || order.bookType === BookType.GHOST) {
          // In a more liquid world, paper and ghost orders are prioritized.
          const executingQty = Math.min(prioritizedRemainingQty, order.remainingQty);
          // TODO(P0): Execute the order.
          prioritizedRemainingQty -= executingQty;
        }
        nextOrder = orderIt.next();
      }
      remainingQty += prioritizedRemainingQty;
      // TODO(P0): Create a ghost order for

      // if remainingQty is 0, then none of the L2 was touched, ghost order qT

      nextTrade = tradeIt.next();
    }
    const partialQtyExecutedFirst = partialQty * this.impedimentFactor;
    const partialQtyExecutedLater = partialQty - partialQtyExecutedFirst;
    remainingQty -= partialQtyExecutedFirst;
    // TODO(P0): Continue.
  }
}
