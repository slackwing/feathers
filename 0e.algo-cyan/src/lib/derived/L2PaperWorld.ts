import { L2OrderBook } from './L2OrderBook';
import { Order } from '../base/Order';
import { OrderBook } from '../base/OrderBook';
import { PubSub } from '../infra/PubSub';
import { VirtualExchange } from '../base/VirtualExchange';
import { AssetPair } from '../base/Asset';

export class L2PaperWorld<A extends AssetPair> extends VirtualExchange<A> {
  protected l2book: L2OrderBook<A>;
  protected paperBook: OrderBook<A>;
  public paperFeed: PubSub<Order<A>>;

  constructor(assetPair: A, l2OrderBook: L2OrderBook<A>, paperFeed: PubSub<Order<A>>) {
    super(assetPair);
    this.l2book = l2OrderBook;
    this.paperBook = new OrderBook<A>(assetPair);
    this.paperFeed = paperFeed;
    this.ingestOrderFeed(l2OrderBook.singleSource);
    this.ingestOrderFeed(paperFeed);
  }
}
