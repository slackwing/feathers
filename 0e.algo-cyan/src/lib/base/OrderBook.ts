import { OrderPriceTimePriorityTree } from './OrderPriceTimePriorityTree';
import { Order, Side } from './Order';

export class OrderBook {
    private bids: OrderPriceTimePriorityTree;
    private asks: OrderPriceTimePriorityTree;

    constructor() {
        this.bids = new OrderPriceTimePriorityTree(Side.BUY);
        this.asks = new OrderPriceTimePriorityTree(Side.SELL);
    }

    onOrder = (order: Order): void => {
        if (order.side === Side.BUY) {
            this.bids.upsertOrder(order);
        } else {
            this.asks.upsertOrder(order);
        }
    }
} 