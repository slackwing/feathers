import { MutableSortedTreeMap } from './MutableSortedTreeMap.js';
import { Order } from './Order.js';

export class OrderTimePriorityTree {
    constructor() {
        this.orders = new MutableSortedTreeMap(
            (orderA, orderB) => orderA.timestamp - orderB.timestamp
        );
        this.timings = {
            upsertOrder: 0,
            removeOrder: 0,
            getOrder: 0,
            iterator: 0
        };
    }

    upsertOrder(order) {
        const start = performance.now();
        this.orders.set(order.id, order);
        this.timings.upsertOrder += performance.now() - start;
    }

    removeOrder(orderId) {
        const start = performance.now();
        this.orders.remove(orderId);
        this.timings.removeOrder += performance.now() - start;
    }

    getOrder(orderId) {
        const start = performance.now();
        const result = this.orders.get(orderId);
        this.timings.getOrder += performance.now() - start;
        return result;
    }

    [Symbol.iterator]() {
        const start = performance.now();
        const result = [];
        if (!this.orders) {
            this.timings.iterator += performance.now() - start;
            return result[Symbol.iterator]();
        }
        for (const [_, order] of this.orders) {
            if (!order) continue;
            result.push(order);
        }
        this.timings.iterator += performance.now() - start;
        return result[Symbol.iterator]();
    }

    getTimings() {
        return {
            ...this.timings,
            underlyingTree: this.orders.getTimings()
        };
    }
}