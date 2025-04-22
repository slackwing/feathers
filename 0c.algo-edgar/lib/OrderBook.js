import { OrderPriceTimePriorityTree } from './OrderPriceTimePriorityTree.js';

export class OrderBook {
    constructor() {
        this.bids = new OrderPriceTimePriorityTree('B');
        this.asks = new OrderPriceTimePriorityTree('S');
        this.worlds = [];
    }

    upsertOrder(order) {
        if (order.side === 'B') {
            this.bids.upsertOrder(order);
        } else {
            this.asks.upsertOrder(order);
        }
        this.worlds.forEach(world => {
            world.reflect(order);
        });
    }

    mirror(world) {
        this.worlds.push(world);
    }
}