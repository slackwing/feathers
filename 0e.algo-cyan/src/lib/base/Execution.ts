import assert from "assert";
import { Order } from "./Order";
import { Side } from "./Order";
import { gt, gte } from "../utils/number";
import { AssetPair } from "./Asset";
import { Fund } from "./Funds";

export enum ExecutionStatus {
  PENDING,
  COMPLETED,
  CANCELLED,
}

export class Execution<A extends AssetPair> {
  readonly assetPair: A;
  readonly buyOrder: Order<A>;
  readonly sellOrder: Order<A>;
  readonly executionPrice: number;
  readonly executionQty: number;
  readonly timestamp: number;
  public status: ExecutionStatus;

  constructor(assetPair: A, takingOrder: Order<A>, makingOrder: Order<A>, executionPrice: number, executionQty: number, timestamp: number) {
    this.assetPair = assetPair;
    if (takingOrder.side === Side.BUY) {
      assert.ok(makingOrder.side === Side.SELL, 'ASSERT: Making order must be a sell order.');
      this.buyOrder = takingOrder;
      this.sellOrder = makingOrder;
    } else {
      assert.ok(makingOrder.side === Side.BUY, 'ASSERT: Making order must be a buy order.');
      this.buyOrder = makingOrder;
      this.sellOrder = takingOrder;
    }
    assert.ok(gt(executionPrice, 0), 'ASSERT: Execution price must be positive.');
    this.executionPrice = executionPrice;
    this.executionQty = executionQty;
    this.timestamp = timestamp;
    this.status = ExecutionStatus.PENDING;
    assert.ok(executionQty > 0, 'ASSERT: Execution quantity must be positive.');
    assert.ok(typeof this.buyOrder.assetPair === typeof this.sellOrder.assetPair, 'ASSERT: Buy and sell orders must be for the same asset pair.');
  }

  private exchangeFunds(): void {
    const cost = this.executionPrice * this.executionQty;
    console.log("ASDF700: " + this.buyOrder.id + " " + this.buyOrder.account.id + " " + this.buyOrder._heldFunds.get(this.buyOrder.assetPair.quote)?.amount);
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
      const cost = this.executionPrice * this.executionQty;
      console.log(`Completed execution of ${this.executionQty} ${this.buyOrder.assetPair.base} for ${cost} ${this.buyOrder.assetPair.quote}`);
    }
  }

  public cancel(): void {
    assert.ok(this.status === ExecutionStatus.PENDING, 'ASSERT: Execution must be pending.');
    this.status = ExecutionStatus.CANCELLED;
  }
}