export class Order {
    constructor(type, id, side, price, quantity, timestamp) {
        this.type = type;
        this.id = id;
        this.side = side;
        this.price = price;
        this.quantity = quantity;
        this.timestamp = timestamp;
        this.filled_qty = 0;
    }

    get remaining_qty() {
        return this.quantity - this.filled_qty;
    }
}