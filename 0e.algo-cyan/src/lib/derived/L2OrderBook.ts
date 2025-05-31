import { AssetPair } from '../base/Asset';
import { Order } from '../base/Order';
import { OrderBook } from '../base/OrderBook';
import { ReadOnlyPubSub } from '../infra/PubSub';

export class L2OrderBook<A extends AssetPair> extends OrderBook<A> {
  public readonly singleSource: ReadOnlyPubSub<Order<A>>;

  constructor(assetPair: A, l2OrderFeed: ReadOnlyPubSub<Order<A>>) {
    super(assetPair, l2OrderFeed);
    this.singleSource = l2OrderFeed;
    this.singleSource.subscribe(this.upsertOrderById);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public subscribe(pubsub: ReadOnlyPubSub<Order<A>>): void {
    // L2OrderBook does not support subscribing to additional feeds.
  }
}
