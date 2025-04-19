import { MutableSortedTreeMap } from './MutableSortedTreeMap.js';
import { assert } from 'assert';
import { OrderTimePriorityTree } from './OrderTimePriorityTree.js';

export class OrderPriceTimePriorityTree {
    constructor(side) {
        assert(side === 'B' || side === 'S', 'Side must be either B or S');
        this.side = side;
        this.priceLevels = new MutableSortedTreeMap(
            (orderA, orderB) => this.side === 'B' ? orderB.price - orderA.price : orderA.price - orderB.price
        );
    }

    upsertOrder(price, order) {
        let priceLevel = this.priceLevels.get(price);
        if (order.quantity > 0) {
            if (!priceLevel) {
                priceLevel = new OrderTimePriorityTree();
                this.priceLevels.set(price, priceLevel);
            }
            priceLevel.upsertOrder(order);
        } else {
            if (priceLevel) {
                priceLevel.removeOrder(order.id);
                if (priceLevel.orders.size === 0) {
                    this.priceLevels.remove(price);
                }
            }
        }
    }

    getOrder(price, orderId) {
        const priceLevel = this.priceLevels.get(price);
        if (priceLevel) {
            return priceLevel.getOrder(orderId);
        }
        return null;
    }

    getOrders(price) {
        return this.priceLevels.get(price);
    }

    [Symbol.iterator]() {
        return {
            *[Symbol.iterator]() {
                for (const [_, priceLevel] of this.priceLevels) {
                    for (const order of priceLevel) {
                        yield order;
                    }
                }
            }
        }.bind(this);
    }
}