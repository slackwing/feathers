import { OrderPriceTimePriorityTree } from './OrderPriceTimePriorityTree';
import { Order, Side } from './Order';
import { PubSub } from '../infra/PubSub';
import { Organizer } from '../infra/Organizer';
import { AssetPair } from './Asset';

export class OrderBook<T extends AssetPair> implements Organizer<Order<T>> {
  readonly assetPair: T;
  protected bids: OrderPriceTimePriorityTree<T>;
  protected asks: OrderPriceTimePriorityTree<T>;

  constructor(assetPair: T, ...pubsubs: PubSub<Order<T>>[]) {
    this.assetPair = assetPair;
    this.bids = new OrderPriceTimePriorityTree(assetPair, Side.BUY);
    this.asks = new OrderPriceTimePriorityTree(assetPair, Side.SELL);
    pubsubs.forEach((pubsub) => this.subscribe(pubsub));
  }

  public reorganize(order: Order<T>): void {
    this.upsertOrderById(order);
  }

  // TODO(P2): Architectural ambiguity. This inserts a new Order instance, even for an update.
  // TODO(P2): This might only be appropriate for new orders and L2 updates.
  // TODO(P2): Actual updates should occur through the Order object itself, which self-organizes.
  // TODO(P2): Oh, wait. The self-organization calls reorganize() above which calls this.
  protected upsertOrderById = (order: Order<T>): void => {
    order.addOrganizer(this);
    if (order.side === Side.BUY) {
      this.bids.upsertOrder(order);
    } else {
      this.asks.upsertOrder(order);
    }
  };

  public subscribe(pubsub: PubSub<Order<T>>): void {
    pubsub.subscribe(this.upsertOrderById);
  }

  public getTopBids(n: number): Order<T>[] {
    return this.bids.first(n);
  }

  public getTopAsks(n: number): Order<T>[] {
    return this.asks.first(n);
  }

  public getBidsUntil(price: number): Order<T>[] {
    return this.bids.until(price);
  }

  public getAsksUntil(price: number): Order<T>[] {
    return this.asks.until(price);
  }
}
