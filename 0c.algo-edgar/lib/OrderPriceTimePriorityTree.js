import { MutableSortedTreeMap } from './MutableSortedTreeMap.js';
import { OrderTimePriorityTree } from './OrderTimePriorityTree.js';

export class OrderPriceTimePriorityTree {
    constructor(side) {
        if (side !== 'B' && side !== 'S') {
            throw new Error('Side must be either B or S');
        }
        this.side = side;
        this.priceLevels = new MutableSortedTreeMap(
            (orderA, orderB) => this.side === 'B' ? orderB.price - orderA.price : orderA.price - orderB.price
        );
        this.timings = {
            upsertOrder: 0,
            getOrder: 0,
            getOrders: 0,
            iterator: 0
        };
    }

    upsertOrder(order) {
        const start = performance.now();
        const price = order.price;
        let priceLevel = this.priceLevels.get(price);
        
        if (!priceLevel) {
            priceLevel = new OrderTimePriorityTree();
            this.priceLevels.set(price, priceLevel);
        }
        
        priceLevel.upsertOrder(order);
        this.timings.upsertOrder += performance.now() - start;
    }

    getOrder(price, orderId) {
        const start = performance.now();
        const priceLevel = this.priceLevels.get(price);
        const result = priceLevel ? priceLevel.getOrder(orderId) : null;
        this.timings.getOrder += performance.now() - start;
        return result;
    }

    getOrders(price) {
        const start = performance.now();
        const result = this.priceLevels.get(price);
        this.timings.getOrders += performance.now() - start;
        return result;
    }

    [Symbol.iterator]() {
        const start = performance.now();
        const priceLevelIterator = this.priceLevels[Symbol.iterator]();
        let currentPriceLevel = null;
        let currentOrderIterator = null;

        const iterator = {
            next() {
                // If we have a current order iterator, try to get next order
                if (currentOrderIterator) {
                    const orderResult = currentOrderIterator.next();
                    if (!orderResult.done) {
                        return orderResult;
                    }
                }

                // Get next price level
                const priceLevelResult = priceLevelIterator.next();
                if (priceLevelResult.done) {
                    return { done: true };
                }

                const [_, level] = priceLevelResult.value;
                if (!level) {
                    return iterator.next(); // Skip empty levels
                }

                currentOrderIterator = level[Symbol.iterator]();
                return iterator.next();
            }
        };

        this.timings.iterator += performance.now() - start;
        return iterator;
    }

    checkMemoryLeak() {
        let totalOrders = 0;
        for (const [_, priceLevel] of this.priceLevels) {
            if (priceLevel) {
                for (const _ of priceLevel) {
                    totalOrders++;
                }
            }
        }
        
        const treeSize = this.priceLevels.size;
        
        // console.log(`OrderPriceTimePriorityTree size check: ${totalOrders} orders in ${treeSize} price levels`);
        
        if (totalOrders > treeSize * 100) {
            // console.warn(`Potential memory leak detected: ${totalOrders} orders in ${treeSize} price levels`);
        }
        
        return { totalOrders, treeSize };
    }

    getTimings() {
        return {
            ...this.timings,
            priceLevels: this.priceLevels.getTimings()
        };
    }
}