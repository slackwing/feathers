export const BookType = {
    L2: 'L2',
    PAPER: 'PAPER'
};

export class Order {
    constructor(type, id, side, price, quantity, timestamp, book_type) {
        this.type = type;
        this.id = id;
        this.side = side;
        this.price = price;
        this.quantity = quantity;
        this.timestamp = timestamp;
        this.filled_qty = 0;
        this.book_type = book_type;
    }

    get remaining_qty() {
        return this.quantity - this.filled_qty;
    }
}