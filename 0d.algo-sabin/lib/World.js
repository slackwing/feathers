import { OrderBook } from './OrderBook.js';

export class World {
    constructor() {
        this._combinedBook = new OrderBook();
    }

    subscribeOrderFeed(orderFeed) {
        orderFeed.subscribe(this._combinedBook.onOrder);
    }

    subscribeTradeFeed(tradeFeed) {
        tradeFeed.subscribe(this._onTrade);
    }

    _onTrade(trade) {
        // Does nothing. Override in subclass.
    }
}