import { Order } from '../base/Order';
import { OrderBook } from '../base/OrderBook';
import { PubSub } from '../infra/PubSub';

export class L2OrderBook extends OrderBook {
    public readonly singleSource: PubSub<Order>;

    // TODO(P2): Should this take price-time or orders?
    constructor(l2OrderFeed: PubSub<Order>) {
        super(l2OrderFeed);
        this.singleSource = l2OrderFeed;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    subscribe(pubsub: PubSub<Order>): void {
        throw new Error('L2OrderBook does not support subscribing to additional feeds.');
    }
} 