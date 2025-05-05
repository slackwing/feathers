import { Order } from '@/lib/base/Order';
import { OrderBook } from '@/lib/base/OrderBook';
import { PubSub } from '@/lib/infra/PubSub';
import { Trade } from '@/lib/base/Trade';
import { BatchedPubSub } from './BatchedPubSub';

export class World {
    public combinedBook: OrderBook;

    constructor() {
        this.combinedBook = new OrderBook();
    }

    public subscribeToOrderFeed(orderFeed: PubSub<Order>): void {
        this.combinedBook.subscribe(orderFeed);
    }

    public subscribeToTradeFeed(tradeFeed: PubSub<Trade>): void {
        tradeFeed.subscribe(this.onTrade);
    }

    public subscribeToBatchedTradeFeed(tradeFeed: BatchedPubSub<Trade>): void {
        tradeFeed.subscribe(this.onTradeBatch);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected onTrade(trade: Trade): void {
        // Does nothing. Override in subclass.
    }

    // Some world models may depend on batches of trades to infer specific
    // information, e.g. a single taker across multiple price levels. By
    // default, simply forwards to onTrade() for each trade.
    protected onTradeBatch(trades: Trade[]): void {
        trades.forEach(trade => this.onTrade(trade));
    }
} 