import { L2OrderBook } from './L2OrderBook';
import { Order } from '../base/Order';
import { OrderBook } from '../base/OrderBook';
import { PubSub } from '../infra/PubSub';
import { Trade } from '../base/Trade';
import { World } from './World';

export class L2PaperWorld extends World {
    private l2: L2OrderBook;
    private paper: OrderBook;

    constructor(l2OrderBook: L2OrderBook, paperFeed: PubSub<Order>) {
        super();
        this.l2 = l2OrderBook;
        this.paper = new OrderBook();
        paperFeed.subscribe(this.paper.onOrder);
        this.subscribeOrderFeed(l2OrderBook.singleSource);
        this.subscribeOrderFeed(paperFeed);
    }

    protected _onTrade(trade: Trade): void {
        // TODO(P0): Implement.
    }
} 