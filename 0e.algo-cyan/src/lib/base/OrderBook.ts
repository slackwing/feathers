import { OrderPriceTimePriorityTree } from './OrderPriceTimePriorityTree';
import { OrderType, Order, Side } from './Order';
import { PubSub } from '../infra/PubSub';
import { SelfOrganizing } from '../infra/SelfOrganizing';
import { Organizer } from '../infra/Organizer';

export class OrderBook implements Organizer<Order> {
  protected bids: OrderPriceTimePriorityTree;
  protected asks: OrderPriceTimePriorityTree;

  constructor(...pubsubs: PubSub<Order>[]) {
    this.bids = new OrderPriceTimePriorityTree(Side.BUY);
    this.asks = new OrderPriceTimePriorityTree(Side.SELL);
    pubsubs.forEach((pubsub) => this.subscribe(pubsub));
  }

  public reorganize(order: Order): void {
    this.upsertOrderById(order);
  }

  // TODO(P2): Architectural ambiguity. This inserts a new Order instance, even for an update.
  // TODO(P2): This might only be appropriate for new orders and L2 updates.
  // TODO(P2): Actual updates should occur through the Order object itself, which self-organizes.
  // TODO(P2): Oh, wait. The self-organization calls reorganize() above which calls this.
  protected upsertOrderById = (order: Order): void => {
    order.addOrganizer(this);
    if (order.side === Side.BUY) {
      this.bids.upsertOrder(order);
    } else {
      this.asks.upsertOrder(order);
    }
  };

  public subscribe(pubsub: PubSub<Order>): void {
    pubsub.subscribe(this.upsertOrderById);
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
