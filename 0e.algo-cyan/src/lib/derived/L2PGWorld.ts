import { L2OrderBook } from './L2OrderBook';
import { BookType, Order, Side } from '../base/Order';
import { OrderBook } from '../base/OrderBook';
import { PubSub } from '../infra/PubSub';
import { Trade } from '../base/Trade';
import { World } from '../base/World';
import { BatchedPubSub } from '../infra/BatchedPubSub';
import * as assert from 'assert';
import { roundQuantity } from '../utils/number';

export enum ReluctanceFactor {
  RELUCTANT,
  AGGRESSIVE_BOUNDED,
  AGGRESSIVE_LIMITED,
  MIDPOINT_BOUNDED,
  MIDPOINT_LIMITED,
}

export const ABSOLUTE_PRIORITY_TIMESTAMP = 0;

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
  }

  protected onTrade = (trade: Trade): void => {
    // The L2PGWorld model relies on batches of trades to infer multi-level price-taking.
  }

  protected onTradeBatch = (trades: Trade[]): void => {

    // console.log('trades = ', trades);

    const reluctanceFactor = this.reluctanceFactorSupplier();
    assert.ok(
      reluctanceFactor === ReluctanceFactor.AGGRESSIVE_LIMITED ||
      reluctanceFactor === ReluctanceFactor.RELUCTANT,
      'ASSERT: Currently only supporting RELUCTANT or AGGRESSIVE_LIMITED.'
    );

    const side = trades[0].side;
    const inside = (a: number, b: number) => (side === Side.BUY ? a > b : a < b);
    const insideOrEqual = (a: number, b: number) => (side === Side.BUY ? a >= b : a <= b);
    const outsideOrEqual = (a: number, b: number) => (side === Side.BUY ? a <= b : a >= b);

    let pPrevious = null;
    let qTradedTotal = 0;
    let qTradedByPrice = new Map<number, number>();
    for (const trade of trades) {
      assert.ok(trade.side === side, 'ASSERT: Expected all trades in batch to be on same side.');
      if (pPrevious !== null) {
        assert.ok(
          outsideOrEqual(trade.price, pPrevious),
          'ASSERT: Expected all trades in a batch to be moving outward.'
        );
      }
      qTradedTotal += trade.quantity;
      qTradedByPrice.set(trade.price, (qTradedByPrice.get(trade.price) || 0) + trade.quantity);
      pPrevious = trade.price;
    }
    assert.ok(
      pPrevious !== null,
      'NEVER: Previous price should have been set by any trade in batch.'
    );
    const outsideTradePrice = pPrevious;

    const orders =
      side === Side.BUY
        ? this.combinedBook.getBidsUntil(outsideTradePrice)
        : this.combinedBook.getAsksUntil(outsideTradePrice);

    let hypotheticalOrderFound = false;
    let qOrdersByPrice = new Map<number, number>();
    for (const order of orders) {
      if (order.bookType === BookType.PAPER || order.bookType === BookType.GHOST) {
        hypotheticalOrderFound = true;
        qOrdersByPrice.set(order.price, (qOrdersByPrice.get(order.price) || 0) + order.remainingQty);
      }
    }

    if (!hypotheticalOrderFound) {
      return;
    }

    const tradeIt = trades[Symbol.iterator]();
    const orderIt = orders[Symbol.iterator]();
    let nextTrade = tradeIt.next();
    let nextOrder = orderIt.next();

    if (reluctanceFactor === ReluctanceFactor.AGGRESSIVE_LIMITED) {

      // NOTE: Check insideOrEqual() because once supporting AGGRESSIVE_BOUNDED there will be orders even farther out.
      while (!nextOrder.done && insideOrEqual(nextOrder.value.price, outsideTradePrice)) {
        const order = nextOrder.value;
        if (order.bookType === BookType.PAPER || order.bookType === BookType.GHOST) {
          order.execute(order.remainingQty);
        }
        nextOrder = orderIt.next();
      }
      // No ghost orders created.

    } else {

      // Unique price levels sorted inside to outside.
      const pLevels =
        [...new Set([...qTradedByPrice.keys(), ...qOrdersByPrice.keys()])]
        .sort((a, b) => inside(a, b) ? -1 : 1);

      let qRemaining = qTradedTotal;
      let pFinalLevel;

      // Execute fully covered price levels.

      for (const pLevel of pLevels) {
        const qTraded = qTradedByPrice.get(pLevel) || 0;
        let qOrders = qOrdersByPrice.get(pLevel) || 0;
        if (qRemaining < qTraded + qOrders) {
          pFinalLevel = pLevel;
          break;
        }
        while (
          qRemaining >= qTraded + qOrders &&
          !nextOrder.done && insideOrEqual(nextOrder.value.price, pLevel)
        ) {
          const order = nextOrder.value;
          if (order.bookType === BookType.PAPER || order.bookType === BookType.GHOST) {
            const executingQty = Math.min(qRemaining, order.remainingQty);
            order.execute(executingQty);
            qRemaining -= executingQty;
            qOrders -= executingQty;
          }
          nextOrder = orderIt.next();
        }
        qRemaining -= qTraded;
      }

      assert.ok(pFinalLevel !== undefined, 'ASSERT: Final price level should have been set.');

      // Execute absolute priority hypothetical orders.

      while (
        qRemaining > 0 &&
        !nextOrder.done && insideOrEqual(nextOrder.value.price, pFinalLevel) &&
        nextOrder.value.timestamp == ABSOLUTE_PRIORITY_TIMESTAMP
      ) {
        const order = nextOrder.value;
        if (order.bookType === BookType.PAPER || order.bookType === BookType.GHOST) {
          const executingQty = Math.min(qRemaining, order.remainingQty);
          order.execute(executingQty);
          qRemaining -= executingQty;
        }
        nextOrder = orderIt.next();
      }

      // Execute impeding L2.

      const qTraded = qTradedByPrice.get(pFinalLevel) || 0;
      const qImpedingL2 = roundQuantity(qTraded * this.impedimentFactorSupplier());
      const executingImpedingQty = Math.min(qRemaining, qImpedingL2);
      qRemaining -= executingImpedingQty;

      // Execute regular priority hypothetical orders.

      while (
        qRemaining > 0 &&
        !nextOrder.done && insideOrEqual(nextOrder.value.price, pFinalLevel)
      ) {
        const order = nextOrder.value;
        if (order.bookType === BookType.PAPER || order.bookType === BookType.GHOST) {
          const executingQty = Math.min(qRemaining, order.remainingQty);
          order.execute(executingQty);
          qRemaining -= executingQty;
        }
        nextOrder = orderIt.next();
      }

      // Execute non-impeding L2.

      const executingNonImpedingQty = Math.min(qRemaining, qTraded - qImpedingL2);
      qRemaining -= executingNonImpedingQty;

      // Create ghost orders for unexecuted L2.

      const qUnexecutedL2 = qTraded - executingImpedingQty - executingNonImpedingQty;

      const impedimentFactor = this.impedimentFactorSupplier();
      const prioritizedGhostQty = roundQuantity(qUnexecutedL2 * impedimentFactor);
      const normalGhostQty = roundQuantity(qUnexecutedL2 * (1 - impedimentFactor));
      
      // TODO(P1): Factor out order ID generation.
      const prioritizedGhostOrderId =
      'G0' +
      side +
      '-' +
      new Date().toISOString().slice(2, 16).replace(/[-]/g, '') +
      '_' +
      String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      this.ghostFeed.publish(new Order(
        'limit',
        prioritizedGhostOrderId,
        side,
        pFinalLevel,
        prioritizedGhostQty,
        ABSOLUTE_PRIORITY_TIMESTAMP,
        BookType.GHOST
      ));
      const normalGhostOrderId =
      'GN' +
      side +
      '-' +
      new Date().toISOString().slice(2, 16).replace(/[-]/g, '') +
      '_' +
      String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      this.ghostFeed.publish(new Order(
        'limit',
        normalGhostOrderId,
        side,
        pFinalLevel,
        normalGhostQty,
        Date.now(),
        BookType.GHOST
      ));

      // Create ghost orders for remaining untouched price levels.

      for (const pLevel of pLevels) {
        if (insideOrEqual(pLevel, pFinalLevel)) {
          continue;
        }
        const qTraded = qTradedByPrice.get(pLevel) || 0;
        const impedimentFactor = this.impedimentFactorSupplier();
        const prioritizedGhostQty = roundQuantity(qTraded * impedimentFactor);
        const normalGhostQty = roundQuantity(qTraded * (1 - impedimentFactor));
        // TODO(P1): Factor out order ID generation.
        const prioritizedGhostOrderId =
        'G0' +
        side +
        '-' +
        new Date().toISOString().slice(2, 16).replace(/[-]/g, '') +
        '_' +
        String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        this.ghostFeed.publish(new Order(
          'limit',
          prioritizedGhostOrderId,
          side,
          pLevel,
          prioritizedGhostQty,
          ABSOLUTE_PRIORITY_TIMESTAMP,
          BookType.GHOST
        ));
        const normalGhostOrderId =
        'GN' +
        side +
        '-' +
        new Date().toISOString().slice(2, 16).replace(/[-]/g, '') +
        '_' +
        String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        this.ghostFeed.publish(new Order(
          'limit',
          normalGhostOrderId,
          side,
          pLevel,
          normalGhostQty,
          Date.now(),
          BookType.GHOST
        ));
      }
    }
  }
}
