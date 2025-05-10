import { L2OrderBook } from './L2OrderBook';
import { Order } from '../base/Order';
import { OrderBook } from '../base/OrderBook';
import { PubSub } from '../infra/PubSub';
import { World } from '../base/World';

export class L2PaperWorld extends World {
  protected l2: L2OrderBook;
  protected paper: OrderBook;

  constructor(l2OrderBook: L2OrderBook, paperFeed: PubSub<Order>) {
    super();
    this.l2 = l2OrderBook;
    this.paper = new OrderBook(paperFeed);
    this.subscribeToOrderFeed(l2OrderBook.singleSource);
    this.subscribeToOrderFeed(paperFeed);
  }
}
