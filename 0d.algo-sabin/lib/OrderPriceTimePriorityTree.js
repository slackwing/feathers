import { MutableSortedTreeMap } from './MutableSortedTreeMap.js';

export class OrderPriceTimePriorityTree {
    constructor(side) {
        if (side !== 'B' && side !== 'S') {
            throw new Error('Side must be either B or S');
        }
        this.side = side;
        this.orders = new MutableSortedTreeMap(
            (orderA, orderB) => {
                // Pre-compute price comparison based on side
                const priceA = this.side === 'B' ? -orderA.price : orderA.price;
                const priceB = this.side === 'B' ? -orderB.price : orderB.price;
                
                // Compare prices first (most significant)
                if (priceA !== priceB) return priceA - priceB;
                
                // Only compare timestamps if prices are equal
                return orderA.timestamp - orderB.timestamp;
            }
        );
        this.timings = {
            upsertOrder: 0,
            iterator: 0
        };
    }

    upsertOrder(order) {
        const start = performance.now();
        if (order.quantity === 0) {
            this.orders.remove(order.id);
        } else {
            this.orders.set(order.id, order);
        }
        this.timings.upsertOrder += performance.now() - start;
    }

    [Symbol.iterator]() {
        const start = performance.now();
        const iterator = this.orders[Symbol.iterator]();
        const result = {
            next() {
                const next = iterator.next();
                if (next.done) {
                    return { done: true };
                }
                const [_, order] = next.value;
                if (!order) {
                    return result.next(); // Skip null orders
                }
                return { value: order, done: false };
            }
        };
        this.timings.iterator += performance.now() - start;
        return result;
    }

    getTimings() {
        return {
            ...this.timings,
            orders: this.orders.getTimings()
        };
    }

    resetTimings() {
        this.timings = {
            upsertOrder: 0,
            iterator: 0
        };
        this.orders.resetTimings();
    }
}