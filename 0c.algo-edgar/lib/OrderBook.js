import { OrderPriceTimePriorityTree } from './OrderPriceTimePriorityTree.js';

export class OrderBook {
    constructor() {
        this.bids = new OrderPriceTimePriorityTree('B');
        this.asks = new OrderPriceTimePriorityTree('S');
        this.worlds = [];
    }

    update(order) {
        // To be implemented
    }

    mirror(world) {
        this.worlds.push(world);
    }
}