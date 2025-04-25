import { OrderPriceTimePriorityTree } from './OrderPriceTimePriorityTree.js';

export class OrderBook {
    constructor() {
        this.bids = new OrderPriceTimePriorityTree('B');
        this.asks = new OrderPriceTimePriorityTree('S');
        this.onOrder = this.onOrder.bind(this);
    }

    onOrder(order) {
        if (order.side === 'B') {
            this.bids.upsertOrder(order);
        } else {
            this.asks.upsertOrder(order);
        }
    }
}