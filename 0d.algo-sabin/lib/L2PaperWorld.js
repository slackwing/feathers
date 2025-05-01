import { World } from './World.js';
import { OrderBook } from './OrderBook.js';

export class L2PaperWorld extends World {
    constructor(l2OrderBook, paperFeed) {
        super();
        this.l2 = l2OrderBook;
        this.paper = new OrderBook();
        paperFeed.subscribe(this.paper.onOrder);
        this.subscribeOrderFeed(l2OrderBook.singleSource);
        this.subscribeOrderFeed(paperFeed);
    }

    _onTrade(trade) {
        // TODO
    }
} 