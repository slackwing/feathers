import { OrderBook } from './OrderBook.js';

export class World {
    constructor() {
        this._combinedBook = new OrderBook();
        this._onTrade = this._onTrade.bind(this);
    }

    // TODO(C++): This is so the book is not subscribed to in other ways (even though it still can).
    get book() {
        return this._combinedBook;
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