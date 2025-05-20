import { L2OrderBook } from './L2OrderBook';
import { Order } from '../base/Order';
import { OrderBook } from '../base/OrderBook';
import { PubSub } from '../infra/PubSub';
import { SingleAssetWorld } from '../base/World_SingleAsset';
import { AssetPair } from '../base/Asset';

export class L2PaperWorld<T extends AssetPair> extends SingleAssetWorld<T> {
  protected l2book: L2OrderBook<T>;
  protected paperBook: OrderBook<T>;
  public paperFeed: PubSub<Order<T>>;

  constructor(assetPair: T, l2OrderBook: L2OrderBook<T>, paperFeed: PubSub<Order<T>>) {
    super(assetPair);
    this.l2book = l2OrderBook;
    this.paperBook = new OrderBook<T>(assetPair);
    this.paperFeed = paperFeed;
    this.subscribeToOrderFeed(l2OrderBook.singleSource);
    this.subscribeToOrderFeed(paperFeed);
  }
}
