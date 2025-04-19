import { MutableSortedTreeMap } from './MutableSortedTreeMap.js';
import { Order } from './Order.js';

export class OrderTimePriorityTree {
    constructor() {
        this.orders = new MutableSortedTreeMap(
            (orderA, orderB) => orderA.timestamp - orderB.timestamp
        );
    }

    insertOrder(order) {
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