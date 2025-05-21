import assert from "assert";
import { Order } from "./Order";
import { Side } from "./Order";
import { gte } from "../utils/number";
import { AssetPair } from "./Asset";
import { Fund } from "./Funds";

export enum ExecutionStatus {
  PENDING,
  COMPLETED,
  CANCELLED,
}

export class Execution<T extends AssetPair> {
  readonly assetPair: T;
  readonly buyOrder: Order<T>;
  readonly sellOrder: Order<T>;
  readonly executionPrice: number;
  readonly executionQty: number;
  readonly timestamp: number;
  public status: ExecutionStatus;

  constructor(assetPair: T, order: Order<T>, oppositeOrder: Order<T>, executionPrice: number, executionQty: number, timestamp: number) {
    this.assetPair = assetPair;
    if (order.side === Side.BUY) {
      this.buyOrder = order;
      assert.ok(oppositeOrder.side === Side.SELL, 'ASSERT: Opposite order must be a sell order.');
      this.sellOrder = oppositeOrder;
    } else {
      assert.ok(order.side === Side.SELL, 'ASSERT: Order must be a sell order.');
      assert.ok(oppositeOrder.side === Side.BUY, 'ASSERT: Opposite order must be a buy order.');
      this.buyOrder = oppositeOrder;
      this.sellOrder = order;
    }
    this.executionPrice = executionPrice;
    this.executionQty = executionQty;
    this.timestamp = timestamp;
    this.status = ExecutionStatus.PENDING;
    assert.ok(executionQty > 0, 'ASSERT: Execution quantity must be positive.');
    assert.ok(typeof this.buyOrder.assetPair === typeof this.sellOrder.assetPair, 'ASSERT: Buy and sell orders must be for the same asset pair.');
  }

  private exchangeFunds(): void {
    const cost = this.executionPrice * this.executionQty;
    const buyerFunds: Fund = this.buyOrder.withdrawFunds(this.buyOrder.assetPair.quote, cost);
    const sellerFunds: Fund = this.sellOrder.withdrawFunds(this.sellOrder.assetPair.base, this.executionQty);
    this.buyOrder.account.depositAsset(sellerFunds);
    this.sellOrder.account.depositAsset(buyerFunds);
  }

  public canExecute(): boolean {
    const cost = this.executionPrice * this.executionQty;
    const canExecute = this.status === ExecutionStatus.PENDING &&
      gte(this.buyOrder.remainingQty, this.executionQty) &&
      gte(this.sellOrder.remainingQty, this.executionQty);
    if (!canExecute) {
      console.warn(`WARNING: Cannot execute! bQty=${this.buyOrder.remainingQty}, sQty=${this.sellOrder.remainingQty}, executionQty=${this.executionQty}, cost=${cost}`);
    }
    return canExecute;
  }

  public execute(): void {
    if (this.canExecute()) {
      this.exchangeFunds();
      this.status = ExecutionStatus.COMPLETED;
      this.buyOrder.executed(this);
      this.sellOrder.executed(this);
      // const cost = this.executionPrice * this.executionQty;
      // console.log(`Completed execution of ${this.executionQty} ${this.buyOrder.assetPair.base} for ${cost} ${this.buyOrder.assetPair.quote}`);
    }
  }

  public cancel(): void {
    assert.ok(this.status === ExecutionStatus.PENDING, 'ASSERT: Execution must be pending.');
    this.status = ExecutionStatus.CANCELLED;
  }
}