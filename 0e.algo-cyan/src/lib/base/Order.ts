export enum BookType {
  L2 = 'L2',
  PAPER = 'PAPER',
  GHOST = 'GHOST',
}

export enum Side {
  BUY = 'B',
  SELL = 'S',
}

export class Order {
  type: string;
  id: string;
  side: Side;
  price: number;
  quantity: number;
  timestamp: number;
  remainingQty: number;
  bookType: BookType;

  constructor(
    type: string,
    id: string,
    side: Side,
    price: number,
    quantity: number,
    timestamp: number,
    bookType: BookType
  ) {
    this.type = type;
    this.id = id;
    this.side = side;
    this.price = price;
    this.quantity = quantity;
    this.timestamp = timestamp;
    this.remainingQty = quantity;
    this.bookType = bookType; // TODO(P3): Not sure if meaningful.
  }

  get filled_qty(): number {
    return this.quantity - this.remainingQty;
  }
}
