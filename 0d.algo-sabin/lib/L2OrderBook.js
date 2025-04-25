import { World } from './World.js';
import { OrderBook } from './OrderBook.js';

export class L2OrderBook extends OrderBook {
    constructor(l2OrderFeed) {
        super();
        this.singleSource = l2OrderFeed; // TODO(C++): Nothing enforces this.
        this.boundOnOrder = super.onOrder.bind(this);
        this.singleSource.subscribe(this.boundOnOrder);
    }
} 