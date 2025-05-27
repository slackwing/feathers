import { L2OrderBook } from './L2OrderBook';
import { OrderType, Order, Side, ABSOLUTE_PRIORITY_TIMESTAMP, ExchangeType } from '../base/Order';
import { OrderBook } from '../base/OrderBook';
import { PubSub } from '../infra/PubSub';
import { Trade } from '../base/Trade';
import { BatchedPubSub } from '../infra/BatchedPubSub';
import * as assert from 'assert';
import { round } from '../utils/number';
import { Execution, ExecutionStatus } from '../base/Execution';
import { Account, InfiniteAccount } from '../base/Account';
import { L2PaperWorld } from './L2PaperWorld';
import { AssetPair } from '../base/Asset';

export enum ReluctanceFactor {
  RELUCTANT,
  AGGRESSIVE_BOUNDED,
  AGGRESSIVE_LIMITED,
  MIDPOINT_BOUNDED,
  MIDPOINT_LIMITED,
}

export class L2PGWorld<A extends AssetPair> extends L2PaperWorld<A> {
  private ghostBook: OrderBook<A>;
  private ghostFeed: PubSub<Order<A>>;
  readonly executionFeed: PubSub<Execution<A>>;
  private ghostAccount: Account;
  private reluctanceFactorSupplier: () => ReluctanceFactor;
  private impedimentFactorSupplier: () => number;
  constructor(
    assetPair: A,
    l2OrderBook: L2OrderBook<A>,
    paperFeed: PubSub<Order<A>>,
    batchedTradeFeed: BatchedPubSub<Trade<A>>,
    reluctanceFactorSupplier: () => ReluctanceFactor,
    impedimentFactorSupplier: () => number
  ) {
    super(assetPair, l2OrderBook, paperFeed);
    this.l2book = l2OrderBook;
    this.ghostFeed = new PubSub<Order<A>>();
    this.ghostBook = new OrderBook<A>(assetPair);
    this.executionFeed = new PubSub<Execution<A>>();
    this.ghostAccount = new InfiniteAccount();
    this.reluctanceFactorSupplier = reluctanceFactorSupplier;
    this.impedimentFactorSupplier = impedimentFactorSupplier;
    this.subscribeToOrderFeed(l2OrderBook.singleSource);
    this.subscribeToOrderFeed(paperFeed);
    this.subscribeToOrderFeed(this.ghostFeed);
    this.subscribeToBatchedTradeFeed(batchedTradeFeed);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onTrade = (trade: Trade<A>): void => {
    // The L2PGWorld model relies on batches of trades to infer multi-level price-taking.
  }

  protected onTradeBatch = (trades: Trade<A>[]): void => {

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
    const qTradedByPrice = new Map<number, number>();
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
    const qOrdersByPrice = new Map<number, number>();
    for (const order of orders) {
      if (order.type === OrderType.PAPER || order.type === OrderType.GHOST) {
        hypotheticalOrderFound = true;
        qOrdersByPrice.set(order.price, (qOrdersByPrice.get(order.price) || 0) + order.remainingQty);
      }
    }

    if (!hypotheticalOrderFound) {
      return;
    }

    const orderIt = orders[Symbol.iterator]();
    let nextOrder = orderIt.next();

    if (reluctanceFactor === ReluctanceFactor.AGGRESSIVE_LIMITED) {

      // NOTE: Check insideOrEqual() because once supporting AGGRESSIVE_BOUNDED there will be orders even farther out.
      while (!nextOrder.done && insideOrEqual(nextOrder.value.price, outsideTradePrice)) {
        const order = nextOrder.value;
        if (order.type === OrderType.PAPER || order.type === OrderType.GHOST) {
          const execution = new Execution<A>(this.assetPair, order, order.mirroring(this.ghostAccount, OrderType.GHOST), order.price, order.remainingQty, Date.now());
          execution.execute();
          if (execution.status === ExecutionStatus.COMPLETED) {
            this.executionFeed.publish(execution);
          } else {
            throw new Error('ASSERT: Execution should have been completed.'); // TODO(P1): Haven't thought what to do here.
          }
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
          if (order.type === OrderType.PAPER || order.type === OrderType.GHOST) {
            const executingQty = Math.min(qRemaining, order.remainingQty);
            const execution = new Execution<A>(this.assetPair, order, order.mirroring(this.ghostAccount, OrderType.GHOST), order.price, executingQty, Date.now());
            execution.execute();
            if (execution.status === ExecutionStatus.COMPLETED) {
              this.executionFeed.publish(execution);
            } else {
              throw new Error('ASSERT: Execution should have been completed.'); // TODO(P1): Haven't thought what to do here.
            }
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
        if (order.type === OrderType.PAPER || order.type === OrderType.GHOST) {
          const executingQty = Math.min(qRemaining, order.remainingQty);
          const execution = new Execution<A>(this.assetPair, order, order.mirroring(this.ghostAccount, OrderType.GHOST), order.price, executingQty, Date.now());
          execution.execute();
          if (execution.status === ExecutionStatus.COMPLETED) {
            this.executionFeed.publish(execution);
          } else {
            throw new Error('ASSERT: Execution should have been completed.'); // TODO(P1): Haven't thought what to do here.
          }
          qRemaining -= executingQty;
        }
        nextOrder = orderIt.next();
      }

      // Execute impeding L2.

      const qTraded = qTradedByPrice.get(pFinalLevel) || 0;
      const qImpedingL2 = round(qTraded * this.impedimentFactorSupplier());
      const executingImpedingQty = Math.min(qRemaining, qImpedingL2);
      qRemaining -= executingImpedingQty;

      // Execute regular priority hypothetical orders.

      while (
        qRemaining > 0 &&
        !nextOrder.done && insideOrEqual(nextOrder.value.price, pFinalLevel)
      ) {
        const order = nextOrder.value;
        if (order.type === OrderType.PAPER || order.type === OrderType.GHOST) {
          const executingQty = Math.min(qRemaining, order.remainingQty);
          const execution = new Execution<A>(this.assetPair, order, order.mirroring(this.ghostAccount, OrderType.GHOST), order.price, executingQty, Date.now());
          execution.execute();
          if (execution.status === ExecutionStatus.COMPLETED) {
            this.executionFeed.publish(execution);
          } else {
            throw new Error('ASSERT: Execution should have been completed.'); // TODO(P1): Haven't thought what to do here.
          }
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
      const prioritizedGhostQty = round(qUnexecutedL2 * impedimentFactor);
      const normalGhostQty = round(qUnexecutedL2 * (1 - impedimentFactor));
      
      this.ghostFeed.publish(new Order<A>(
        this.assetPair,
        this.ghostAccount,
        OrderType.GHOST,
        ExchangeType.LIMIT,
        side,
        pFinalLevel,
        prioritizedGhostQty,
        ABSOLUTE_PRIORITY_TIMESTAMP
      ));
      
      this.ghostFeed.publish(new Order<A>(
        this.assetPair,
        this.ghostAccount,
        OrderType.GHOST,
        ExchangeType.LIMIT,
        side,
        pFinalLevel,
        normalGhostQty,
        Date.now()
      ));

      // Create ghost orders for remaining untouched price levels.

      for (const pLevel of pLevels) {
        if (insideOrEqual(pLevel, pFinalLevel)) {
          continue;
        }
        const qTraded = qTradedByPrice.get(pLevel) || 0;
        const impedimentFactor = this.impedimentFactorSupplier();
        const prioritizedGhostQty = round(qTraded * impedimentFactor);
        const normalGhostQty = round(qTraded * (1 - impedimentFactor));
      
        this.ghostFeed.publish(new Order<A>(
          this.assetPair,
          this.ghostAccount,
          OrderType.GHOST,
          ExchangeType.LIMIT,
          side,
          pLevel,
          prioritizedGhostQty,
          ABSOLUTE_PRIORITY_TIMESTAMP
        ));
        
        this.ghostFeed.publish(new Order<A>(
          this.assetPair,
          this.ghostAccount,
          OrderType.GHOST,
          ExchangeType.LIMIT,
          side,
          pLevel,
          normalGhostQty,
          Date.now()
        ));
      }
    }
  }
}
