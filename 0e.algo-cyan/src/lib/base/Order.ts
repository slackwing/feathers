import assert from "assert";
import { Cloneable } from "../infra/Cloneable";
import { SelfOrganizing } from "../infra/SelfOrganizing";
import { Organizer } from "../infra/Organizer";
import { Asset, AssetPair } from "./Asset";
import { Fund, safelyWithdrawFunds } from "./Funds";
import { Execution, ExecutionStatus } from "./Execution";
import { Account } from "./Account";
import { round } from "../utils/number";

export enum OrderType {
  L2 = 'L2',
  PAPER = 'PAPER',
  GHOST = 'GHOST',
}

export enum ExchangeType {
  LIMIT = 'LIMIT',
  MARKET = 'MARKET',
}

export enum Side {
  BUY = 'B',
  SELL = 'S',
}

export const ABSOLUTE_PRIORITY_TIMESTAMP = 0;

let globalCounter = 0;

export function toBase34Max39304(num: number): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Skips I and O
  const base = chars.length;
  const maxValue = Math.pow(base, 3);
  if (num < 0) throw new Error('Number must be non-negative');
  let n = num % maxValue;
  let result = '';
  while (result.length < 3) {
    result = chars[n % base] + result;
    n = Math.floor(n / base);
  }
  return result;
}

export class Order<T extends AssetPair> extends SelfOrganizing<Order<T>, Organizer<Order<T>>> implements Cloneable<Order<T>> {
  readonly assetPair: T;
  readonly account: Account
  readonly type: OrderType;
  readonly exchangeType: ExchangeType;
  readonly side: Side;
  private _id: string;
  private _price: number;
  private _quantity: number;
  private _timestamp: number;
  private _remainingQty: number;
  private _executions: Set<Execution<T>>;
  private _heldFunds: Map<Asset, Fund>;

  constructor(
    assetPair: T,
    account: Account,
    type: OrderType,
    exchangeType: ExchangeType,
    side: Side,
    price: number,
    quantity: number,
    timestamp: number,
  ) {
    super();
    this.assetPair = assetPair;
    this.account = account;
    this.type = type;
    this.exchangeType = exchangeType;
    this.side = side;
    this._id = this.generateId(type, side, price, timestamp);
    this._price = price;
    this._quantity = quantity;
    this._timestamp = timestamp;
    this._remainingQty = quantity;
    this._executions = new Set<Execution<T>>();
    this._heldFunds = new Map<Asset, Fund>();
    const fundingAsset = side === Side.BUY ? assetPair.quote : assetPair.base;
    const fundingAmount = side === Side.BUY ? this.price * quantity : quantity;
    this._heldFunds.set(fundingAsset, account.withdrawAsset(fundingAsset, fundingAmount));
  }

  private generateId(type: OrderType, side: Side, price: number, timestamp: number): string {
    if (type === OrderType.L2) {
      const priceStr = price.toLocaleString('fullwide', { useGrouping: false });
      return `L2-${side}-${priceStr}`;
    } else if (type === OrderType.PAPER) {
      const priorityStr = timestamp === ABSOLUTE_PRIORITY_TIMESTAMP ? '0' : 'P';
      const dateStr = new Date().toISOString().slice(2, 19).replace(/[-]/g, '');
      const counterStr = toBase34Max39304(globalCounter++);
      return `P${priorityStr}${side}-${dateStr}-${counterStr}`;
    } else if (type === OrderType.GHOST) {
      const priorityStr = timestamp === ABSOLUTE_PRIORITY_TIMESTAMP ? '0' : 'H';
      const dateStr = new Date().toISOString().slice(2, 19).replace(/[-]/g, '');
      const counterStr = toBase34Max39304(globalCounter++);
      return `G${priorityStr}${side}-${dateStr}-${counterStr}`;
    } else {
      assert.fail('Invalid order type.');
    }
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

  public withdrawFunds(asset: Asset, amount: number): Fund {
    return safelyWithdrawFunds(asset, amount, this._heldFunds);
  }

  public executed(execution: Execution<T>): void {
    if (this.side === Side.BUY) {
      assert.ok(this === execution.buyOrder, 'ASSERT: Non-matching buy order and execution.');
    } else {
      assert.ok(this === execution.sellOrder, 'ASSERT: Non-matching sell order and execution.');
    }
    assert.ok(execution.status === ExecutionStatus.COMPLETED, 'ASSERT: Execution must be completed.');
    assert.ok(!this._executions.has(execution), 'ASSERT: Execution already processed for this order.');
    this.remainingQty = round(this._remainingQty - execution.executionQty);
    this._executions.add(execution);
  }

  /**
   * NOTE(DECOMISSIONED): See BifurcatingPubSub.
   */
  public clone(): Order<T> {
    const cloned = new Order<T>(
      this.assetPair,
      this.account,
      this.type,
      this.exchangeType,
      this.side,
      this.price,
      this.quantity,
      this.timestamp
    );
    cloned._id = this.id;
    cloned.remainingQty = this.remainingQty;
    return cloned;
  }

public mirroring(account: Account, type: OrderType): Order<T> {
    const cloned = new Order<T>(
      this.assetPair,
      account,
      type,
      this.exchangeType,
      this.side === Side.BUY ? Side.SELL : Side.BUY,
      this.price,
      this.quantity,
      this.timestamp
    );
    cloned.remainingQty = this.remainingQty;
    return cloned;
  }
}
