import { L2OrderBook } from './L2OrderBook';
import { Order } from '../base/Order';
import { OrderBook } from '../base/OrderBook';
import { PubSub } from '../infra/PubSub';
import { Trade } from '../base/Trade';
import { World } from '../base/World';
import { BatchedPubSub } from '../base/BatchedPubSub';

export class L2PGWorld extends World {
    private l2: L2OrderBook;
    private paper: OrderBook;
    private ghost: OrderBook;
    private ghostFeed: PubSub<Order>;
    constructor(l2OrderBook: L2OrderBook, paperFeed: PubSub<Order>, batchedTradeFeed: BatchedPubSub<Trade>, liquidityFactor: number) {
        super();
        this.l2 = l2OrderBook;
        this.paper = new OrderBook(paperFeed);
        this.ghostFeed = new PubSub<Order>();
        this.ghost = new OrderBook(this.ghostFeed);
        this.subscribeToOrderFeed(l2OrderBook.singleSource);
        this.subscribeToOrderFeed(paperFeed);
        this.subscribeToOrderFeed(this.ghostFeed);
        this.subscribeToBatchedTradeFeed(batchedTradeFeed);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected onTrade(trade: Trade): void {
        // The L2PGWorld model relies on batches of trades to infer multi-level price-taking.
    }

    protected onTradeBatch(trades: Trade[]): void {
        console.log(trades);
    }
} 