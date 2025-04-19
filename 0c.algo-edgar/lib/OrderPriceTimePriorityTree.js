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

    insertOrder(order) {
        const price = order.price;
        let priceLevel = this.priceLevels.get(price);
        
        if (!priceLevel) {
            priceLevel = new OrderTimePriorityTree();
            this.priceLevels.set(price, priceLevel);
        }
        
        priceLevel.insertOrder(order);
    }

    removeOrder(price, orderId) {
        const priceLevel = this.priceLevels.get(price);
        if (priceLevel) {
            priceLevel.removeOrder(orderId);
            if (priceLevel.orders.size === 0) {
                this.priceLevels.remove(price);
            }
        }
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