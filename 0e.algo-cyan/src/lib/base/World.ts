import { Order } from './Order';
import { OrderBook } from './OrderBook';
import { PubSub } from '../infra/PubSub';
import { Trade } from './Trade';

export class World {
    public combinedBook: OrderBook;
    protected onTrade(trade: Trade): void {
        // Does nothing. Override in subclass.
    }

    constructor() {
        this.combinedBook = new OrderBook();
    }

    subscribeToOrderFeed(orderFeed: PubSub<Order>): void {
        this.combinedBook.subscribe(orderFeed);
    }

    subscribeToTradeFeed(tradeFeed: PubSub<Trade>): void {
        tradeFeed.subscribe(this.onTrade);
    }
} 