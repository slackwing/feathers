import { OrderPriceTimePriorityTree } from './OrderPriceTimePriorityTree';
import { Order, Side } from './Order';
import { PubSub } from '../infra/PubSub';

export class OrderBook {
    private bids: OrderPriceTimePriorityTree;
    private asks: OrderPriceTimePriorityTree;

    constructor(...pubsubs: PubSub<Order>[]) {
        this.bids = new OrderPriceTimePriorityTree(Side.BUY);
        this.asks = new OrderPriceTimePriorityTree(Side.SELL);
        pubsubs.forEach(pubsub => this.subscribe(pubsub));
    }

    private onOrder = (order: Order): void => {
        if (order.side === Side.BUY) {
            this.bids.upsertOrder(order);
        } else {
            this.asks.upsertOrder(order);
        }
    }

    subscribe(pubsub: PubSub<Order>): void {
        pubsub.subscribe(this.onOrder);
    }

    getTopBids(n: number): Order[] {
        return this.bids.first(n);
    }

    getTopAsks(n: number): Order[] {
        return this.asks.first(n);
    }

    getBidsUntil(price: number): Order[] {
        return this.bids.until(price);
    }

    getAsksUntil(price: number): Order[] {
        return this.asks.until(price);
    }
} 