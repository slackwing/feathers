import { MutableSortedTreeMap } from './MutableSortedTreeMap.js';
import { Order } from './Order.js';

export class OrderTimePriorityTree {
    constructor() {
        this.orders = new MutableSortedTreeMap(
            (orderA, orderB) => orderA.timestamp - orderB.timestamp
        );
    }

    upsertOrder(order) {
        // Later, might be more performant to copy over the quantity, etc.
        this.orders.set(order.id, order);
    }

    removeOrder(orderId) {
        this.orders.remove(orderId);
    }

    getOrder(orderId) {
        return this.orders.get(orderId);
    }

    [Symbol.iterator]() {
        return this.orders[Symbol.iterator]();
    }
}