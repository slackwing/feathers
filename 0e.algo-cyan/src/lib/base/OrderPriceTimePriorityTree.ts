import { MutableSortedTreeMap } from '../infra/MutableSortedTreeMap';
import { Order, Side } from './Order';

export class OrderPriceTimePriorityTree {
    private side: Side;
    private orders: MutableSortedTreeMap<Order>;
    private timings: {
        upsertOrder: number;
        iterator: number;
    };

    constructor(side: Side) {
        this.side = side;
        this.orders = new MutableSortedTreeMap<Order>(
            (orderA, orderB) => {
                const priceA = this.side === Side.BUY ? -orderA.price : orderA.price;
                const priceB = this.side === Side.BUY ? -orderB.price : orderB.price;
                
                if (priceA !== priceB) return priceA - priceB;
                return orderA.timestamp - orderB.timestamp;
            }
        );
        this.timings = {
            upsertOrder: 0,
            iterator: 0
        };
    }

    upsertOrder(order: Order): void {
        const start = performance.now();
        if (order.quantity === 0) {
            this.orders.remove(order.id);
        } else {
            this.orders.set(order.id, order);
        }
        this.timings.upsertOrder += performance.now() - start;
    }

    [Symbol.iterator](): Iterator<Order> {
        const start = performance.now();
        const iterator = this.orders[Symbol.iterator]();
        const result = {
            next: (): IteratorResult<Order> => {
                const next = iterator.next();
                if (next.done) {
                    return { done: true, value: undefined };
                }
                const [_, order] = next.value;
                if (!order) {
                    return result.next();
                }
                return { value: order, done: false };
            }
        };
        this.timings.iterator += performance.now() - start;
        return result;
    }

    getTimings(): { upsertOrder: number; iterator: number } {
        return {
            ...this.timings
        };
    }

    resetTimings(): void {
        this.timings = {
            upsertOrder: 0,
            iterator: 0
        };
    }
} 