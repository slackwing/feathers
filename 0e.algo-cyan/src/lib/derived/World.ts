import { Order } from '../base/Order';
import { OrderBook } from '../base/OrderBook';
import { PubSub } from '../infra/PubSub';
import { Trade } from '../base/Trade';

export class World {
    public combinedBook: OrderBook;
    protected onTrade(trade: Trade): void {
        // Does nothing. Override in subclass.
    }

    constructor() {
        this.combinedBook = new OrderBook();
    }

    subscribeOrderFeed(orderFeed: PubSub<Order>): void {
        orderFeed.subscribe(this.combinedBook.onOrder);
    }

    subscribeTradeFeed(tradeFeed: PubSub<Trade>): void {
        tradeFeed.subscribe(this.onTrade);
    }
} 