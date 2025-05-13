import assert from "assert";
import { Cloneable } from "../infra/Cloneable";
import { SelfOrganizing } from "../infra/SelfOrganizing";
import { OrderBook } from "./OrderBook";

export enum BookType {
  L2 = 'L2',
  PAPER = 'PAPER',
  GHOST = 'GHOST',
}

export enum Side {
  BUY = 'B',
  SELL = 'S',
}

export class Order extends SelfOrganizing<Order, OrderBook> implements Cloneable<Order> {
  readonly type: string;
  readonly side: Side;
  readonly bookType: BookType;
  private _id: string;
  private _price: number;
  private _quantity: number;
  private _timestamp: number;
  private _remainingQty: number;

  constructor(
    type: string,
    id: string,
    side: Side,
    price: number,
    quantity: number,
    timestamp: number,
    bookType: BookType
  ) {
    super();
    this.type = type;
    this._id = id;
    this.side = side;
    this._price = price;
    this._quantity = quantity;
    this._timestamp = timestamp;
    this._remainingQty = quantity;
    this.bookType = bookType; // TODO(P3): Not sure if meaningful.
  }

  get remainingQty(): number { return this._remainingQty; }
  set remainingQty(value: number) {
    if (this._remainingQty !== value) {
      this._remainingQty = value;
      if (this._remainingQty <= 0) {
        this.selfOrganize(this);
      }
    }
  }

  get id(): string { return this._id; }
  set id(value: string) {
    if (this._id !== value) {
      this._id = value;
      this.selfOrganize(this);
    }
  }

  get price(): number { return this._price; }
  set price(value: number) {
    if (this._price !== value) {
      this._price = value;
      this.selfOrganize(this);
    }
  }

  get timestamp(): number { return this._timestamp; }
  set timestamp(value: number) {
    if (this._timestamp !== value) {
      this._timestamp = value;
      this.selfOrganize(this);
    }
  }

  get quantity(): number { return this._quantity; }
  set quantity(value: number) {
    if (this._quantity !== value) {
      const delta = value - this._quantity;
      this._quantity += delta;
      this.remainingQty = this.remainingQty + delta;
    }
  }

  get filled_qty(): number {
    return Math.max(0, this.quantity - this.remainingQty);
  }

  public execute(quantity: number): void {
    assert.ok(quantity > 0, 'ASSERT: Quantity to execute must be positive.');
    assert.ok(quantity <= this.remainingQty, 'ASSERT: Quantity to execute must be less than or equal to remaining quantity.');
    console.log('Executing ', quantity, ' of ', this.id);
    this.remainingQty = this._remainingQty - quantity;
  }

  public clone(): Order {
    const cloned = new Order(this.type, this.id, this.side, this.price, this.quantity, this.timestamp, this.bookType);
    cloned.remainingQty = this.remainingQty;
    return cloned;
  }
}
