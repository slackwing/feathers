export enum BookType {
    L2 = 'L2',
    PAPER = 'PAPER',
    GHOST = 'GHOST'
}

export enum Side {
    BUY = 'B',
    SELL = 'S'
}

export class Order {
    type: string;
    id: string;
    side: Side;
    price: number;
    quantity: number;
    timestamp: number;
    remaining_qty: number;
    book_type: BookType;

    constructor(type: string, id: string, side: Side, price: number, quantity: number, timestamp: number, book_type: BookType) {
        this.type = type;
        this.id = id;
        this.side = side;
        this.price = price;
        this.quantity = quantity;
        this.timestamp = timestamp;
        this.remaining_qty = quantity;
        this.book_type = book_type; // TODO(P3): Not sure if meaningful.
    }

    get filled_qty(): number {
        return this.quantity - this.remaining_qty;
    }
} 