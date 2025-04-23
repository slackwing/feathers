import { OrderBook } from './OrderBook.js';

export class World {
    constructor(level2Book) {
        this.level2Book = level2Book;
        this.paperBook = new OrderBook();
        this.ghostBook = new OrderBook();
        this.combinedBook = new OrderBook();
    }

    upsertOrder(order) {
        this.combinedBook.upsertOrder(order);
    }
}