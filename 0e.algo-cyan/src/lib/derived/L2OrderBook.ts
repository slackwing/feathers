import { Order } from '../base/Order';
import { OrderBook } from '../base/OrderBook';
import { PubSub } from '../infra/PubSub';

export class L2OrderBook extends OrderBook {
    public readonly singleSource: PubSub<Order>;

    // TODO(P2): Should this take price-time or orders?
    constructor(l2OrderFeed: PubSub<Order>) {
        super();
        this.singleSource = l2OrderFeed;
        this.singleSource.subscribe((order) => this.onOrder(order));
    }
} 