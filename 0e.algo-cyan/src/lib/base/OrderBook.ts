import { OrderPriceTimePriorityTree } from './OrderPriceTimePriorityTree';
import { Order, Side } from './Order';
import { ReadOnlyPubSub } from '../infra/PubSub';
import { Organizer } from '../infra/Organizer';
import { AssetPair } from './Asset';

export class OrderBook<A extends AssetPair> implements Organizer<Order<A>> {
  public readonly assetPair: A;
  public readonly bids: OrderPriceTimePriorityTree<A>;
  public readonly asks: OrderPriceTimePriorityTree<A>;

  constructor(assetPair: A, ...pubsubs: ReadOnlyPubSub<Order<A>>[]) {
    this.assetPair = assetPair;
    this.bids = new OrderPriceTimePriorityTree(assetPair, Side.BUY);
    this.asks = new OrderPriceTimePriorityTree(assetPair, Side.SELL);
    pubsubs.forEach((pubsub) => this.ingestOrderFeed(pubsub));
  }

  public reorganize(order: Order<A>): void {
    this.upsertOrderById(order);
  }

  // TODO(P2): Architectural ambiguity. This inserts a new Order instance, even for an update.
  // TODO(P2): This might only be appropriate for new orders and L2 updates.
  // TODO(P2): Actual updates should occur through the Order object itself, which self-organizes.
  // TODO(P2): Oh, wait. The self-organization calls reorganize() above which calls this.
  protected upsertOrderById = (order: Order<A>): void => {
    order.addOrganizer(this);
    if (order.side === Side.BUY) {
      this.bids.upsertOrder(order);
    } else {
      this.asks.upsertOrder(order);
    }
  };

  public ingestOrderFeed(pubsub: ReadOnlyPubSub<Order<A>>): void {
    pubsub.subscribe(this.upsertOrderById);
  }

  public getTopBids(n: number): Order<A>[] {
    return this.bids.first(n);
  }

  public getTopAsks(n: number): Order<A>[] {
    return this.asks.first(n);
  }

  public getBidsUntil(price: number): Order<A>[] {
    return this.bids.until(price);
  }

  public getAsksUntil(price: number): Order<A>[] {
    return this.asks.until(price);
  }
}
