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
    MIDPOINT_LIMITED
}

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
        impedimentFactorSupplier: () => number) {
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
        assert.ok(batchedTradeFeed.getMaxTimeout() === 0, "ASSERT: Expected batched trade feed with max timeout of 0.");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected onTrade(trade: Trade): void {
        // The L2PGWorld model relies on batches of trades to infer multi-level price-taking.
    }

    protected onTradeBatch(trades: Trade[]): void {

        const reluctanceFactor = this.reluctanceFactorSupplier();
        const impedimentFactor = this.impedimentFactorSupplier();
        assert.ok(impedimentFactor >= 0 && impedimentFactor <= 1, "ASSERT: Expected impediment factor to be between 0 and 1.");
        assert.ok(reluctanceFactor >= 0 && reluctanceFactor <= 1, "ASSERT: Expected reluctance factor to be between 0 and 1.");
        assert.ok(reluctanceFactor === ReluctanceFactor.AGGRESSIVE_LIMITED || reluctanceFactor === ReluctanceFactor.RELUCTANT, "ASSERT: Currently only supporting RELUCTANT or AGGRESSIVE_LIMITED.");
        
        // console.log(trades);
        const side = trades[0].side;
        const inside = (a: number, b: number) => side === Side.BUY ? a > b : a < b;
        const insideOrEqual = (a: number, b: number) => side === Side.BUY ? a >= b : a <= b;
        const outsideOrEqual = (a: number, b: number) => side === Side.BUY ? a <= b : a >= b;
        let previousPrice = null;
        let remainingQty = 0;
        for (const trade of trades) {
            assert.ok(trade.side === side, "ASSERT: Expected all trades in batch to be on same side.");
            if (previousPrice === null) {
                previousPrice = trade.price;
            } else {
                assert.ok(
                    outsideOrEqual(trade.price, previousPrice),
                    "ASSERT: Expected all trades in a batch to be moving outward.");
            }
            remainingQty += trade.quantity;
        }
        assert.ok(previousPrice !== null, "NEVER: Previous price should have been set by any trade in batch.");
        const outsideTradePrice = previousPrice;
        const orders = side === Side.BUY ? this.combinedBook.getBidsUntil(outsideTradePrice) : this.combinedBook.getAsksUntil(outsideTradePrice);

        const tradeIt = trades[Symbol.iterator]();
        const orderIt = orders[Symbol.iterator]();
        let nextTrade = tradeIt.next();
        let nextOrder = orderIt.next();

        if (reluctanceFactor === ReluctanceFactor.AGGRESSIVE_LIMITED) {

            // NOTE: Check insideOrEqual() because once supporting AGGRESSIVE_BOUNDED there will be orders even farther out.
            while (!nextOrder.done && insideOrEqual(nextOrder.value.price, outsideTradePrice)) {
                const order = nextOrder.value;
                if (order.bookType === BookType.PAPER ||
                    order.bookType === BookType.GHOST) {
                    // TODO(P0): Execute the order.
                }
                nextOrder = orderIt.next();
            }
            // No ghost orders created.

        } else {
            while (remainingQty > 0 && !nextTrade.done) {
                const trade = nextTrade.value;
                // For all orders crossed by this trade...
                while (remainingQty > 0 && !nextOrder.done && inside(nextOrder.value.price, trade.price)) {
                    const order = nextOrder.value;
                    if (order.bookType === BookType.PAPER ||
                        order.bookType === BookType.GHOST) {
                        // If order was crossed, definitely would have been executed.
                        const executingQty = Math.min(remainingQty, order.remainingQty);
                        // TODO(P0): Execute the order.
                        remainingQty -= executingQty;
                    }
                    nextOrder = orderIt.next();
                }
                nextTrade = tradeIt.next();
            }
            if (remainingQty <= 0) {
                // If out of quantity before even reaching the outside trade price,
                // create ghost orders to compensate quantity of trades at each
                // price level.
                while (!nextTrade.done) {
                    const trade = nextTrade.value;
                    const prioritizedGhostQty = trade.quantity * this.impedimentFactor;
                    const normalGhostQty = trade.quantity - prioritizedGhostQty;
                    // TODO(P0): Create ghost orders.
                    nextTrade = tradeIt.next();
                }
            } else {

            }






            let prioritizedRemainingQty = remainingQty * this.impedimentFactor;
            remainingQty -= prioritizedRemainingQty;
            while (prioritizedRemainingQty > 0 && !nextOrder.done && insideOrEqual(nextOrder.value.price, trade.price)) {
                const order = nextOrder.value;
                if (order.bookType === BookType.PAPER ||
                    order.bookType === BookType.GHOST) {
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