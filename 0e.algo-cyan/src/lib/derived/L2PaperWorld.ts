import { L2OrderBook } from './L2OrderBook';
import { Order } from '../base/Order';
import { OrderBook } from '../base/OrderBook';
import { PubSub } from '../infra/PubSub';
import { World } from '../base/World';
import { AssetPair } from '../base/Asset';

export class L2PaperWorld extends World {
  protected l2book: L2OrderBook;
  protected paperBook: OrderBook;
  public paperFeed: PubSub<Order>;

  constructor(assetPair: AssetPair, l2OrderBook: L2OrderBook, paperFeed: PubSub<Order>) {
    super(assetPair);
    this.l2book = l2OrderBook;
    this.paperBook = new OrderBook(paperFeed);
    this.paperFeed = paperFeed;
    this.subscribeToOrderFeed(l2OrderBook.singleSource);
    this.subscribeToOrderFeed(paperFeed);
  }
}
