import { OrderPriceTimePriorityTree } from './OrderPriceTimePriorityTree';
import { Order, Side } from './Order';
import { PubSub } from '../infra/PubSub';

export class OrderBook {
  protected bids: OrderPriceTimePriorityTree;
  protected asks: OrderPriceTimePriorityTree;

  constructor(...pubsubs: PubSub<Order>[]) {
    this.bids = new OrderPriceTimePriorityTree(Side.BUY);
    this.asks = new OrderPriceTimePriorityTree(Side.SELL);
    pubsubs.forEach((pubsub) => this.subscribe(pubsub));
  }

  protected onOrder = (order: Order): void => {
    if (order.side === Side.BUY) {
      this.bids.upsertOrder(order);
    } else {
      this.asks.upsertOrder(order);
    }
  };

  public subscribe(pubsub: PubSub<Order>): void {
    pubsub.subscribe(this.onOrder);
  }

  public getTopBids(n: number): Order[] {
    return this.bids.first(n);
  }

  public getTopAsks(n: number): Order[] {
    return this.asks.first(n);
  }

  public getBidsUntil(price: number): Order[] {
    return this.bids.until(price);
  }

  public getAsksUntil(price: number): Order[] {
    return this.asks.until(price);
  }
}
