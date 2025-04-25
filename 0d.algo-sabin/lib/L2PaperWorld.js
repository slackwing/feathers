import { World } from './World.js';

export class L2PaperWorld extends World {
    constructor(l2OrderBook, paperFeed) {
        super();
        this.l2 = l2OrderBook;
        this.paper = new OrderBook();
        this.paper.subscribe(paperFeed);
        this.subscribeOrderFeed(l2OrderBook); // TODO, type everything
        this.subscribeOrderFeed(paperFeed);
    }

    _onTrade(trade) {
        // TODO
    }
} 