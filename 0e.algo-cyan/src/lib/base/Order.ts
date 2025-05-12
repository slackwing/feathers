import assert from "assert";
import { Cloneable } from "../infra/Cloneable";

export enum BookType {
  L2 = 'L2',
  PAPER = 'PAPER',
  GHOST = 'GHOST',
}

export enum Side {
  BUY = 'B',
  SELL = 'S',
}

export class Order implements Cloneable<Order> {
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

  public execute(quantity: number): void {
    assert.ok(quantity > 0, 'ASSERT: Quantity to execute must be positive.');
    assert.ok(quantity <= this.remainingQty, 'ASSERT: Quantity to execute must be less than or equal to remaining quantity.');
    console.log('Executing ', quantity, ' of ', this.id);
    this.remainingQty -= quantity;
  }

  public clone(): Order {
    const cloned = new Order(this.type, this.id, this.side, this.price, this.quantity, this.timestamp, this.bookType);
    cloned.remainingQty = this.remainingQty;
    return cloned;
  }
}
