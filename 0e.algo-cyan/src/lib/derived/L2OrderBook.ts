import { AssetPair } from '../base/Asset';
import { Order } from '../base/Order';
import { OrderBook } from '../base/OrderBook';
import { PubSub } from '../infra/PubSub';

export class L2OrderBook<T extends AssetPair> extends OrderBook<T> {
  readonly singleSource: PubSub<Order<T>>;

  constructor(assetPair: T, l2OrderFeed: PubSub<Order<T>>) {
    super(assetPair, l2OrderFeed);
    this.singleSource = l2OrderFeed;
    this.singleSource.subscribe(this.upsertOrderById);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public subscribe(pubsub: PubSub<Order<T>>): void {
    // L2OrderBook does not support subscribing to additional feeds.
  }
}
