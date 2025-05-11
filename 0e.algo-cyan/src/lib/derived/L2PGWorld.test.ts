import { ABSOLUTE_PRIORITY_TIMESTAMP, L2PGWorld, ReluctanceFactor } from './L2PGWorld';
import { L2OrderBook } from './L2OrderBook';
import { PubSub } from '../infra/PubSub';
import { BatchedPubSub } from '../base/BatchedPubSub';
import { Order, Side, BookType } from '../base/Order';
import { Trade } from '../base/Trade';

describe('L2PGWorld', () => {
  let l2OrderBook: L2OrderBook;
  let paperFeed: PubSub<Order>;
  let batchedTradeFeed: BatchedPubSub<Trade>;
  let world: L2PGWorld;

  const paperX = new Order('limit', 'PAPER-X', Side.SELL, 102, 2.0, Date.now(), BookType.PAPER);
  const ghostM = new Order('limit', 'GHOST-M', Side.SELL, 103, 4.0, Date.now(), BookType.GHOST);
  const ghost0 = new Order('limit', 'GHOST-0', Side.SELL, 104, 2.0, ABSOLUTE_PRIORITY_TIMESTAMP, BookType.GHOST);
  const paperP = new Order('limit', 'PAPER-P', Side.SELL, 104, 1.0, Date.now() + 1000, BookType.PAPER);
  const ghostP = new Order('limit', 'GHOST-P', Side.SELL, 104, 3.0, Date.now() + 2000, BookType.GHOST);
  const ghostF = new Order('limit', 'GHOST-F', Side.SELL, 108, 1.0, ABSOLUTE_PRIORITY_TIMESTAMP, BookType.GHOST);
  const paperF = new Order('limit', 'PAPER-F', Side.SELL, 108, 1.0, Date.now() + 1000, BookType.PAPER);

  const now = Date.now();
  const trade100 = new Trade(Side.SELL, 100, 2.0, now);
  const trade102a = new Trade(Side.SELL, 102, 1.0, now);
  const trade102b = new Trade(Side.SELL, 102, 3.0, now);
  const trade103a = new Trade(Side.SELL, 103, 4.0, now);
  const trade103b = new Trade(Side.SELL, 103, 2.0, now);
  const trade104a = new Trade(Side.SELL, 104, 1.0, now);
  const trade104b = new Trade(Side.SELL, 104, 1.0, now);
  let trade107; // This trade quantity will be altered in each test.
  const trade108a = new Trade(Side.SELL, 108, 1.5, now);
  const trade108b = new Trade(Side.SELL, 108, 1.5, now);
  const trade99 = new Trade(Side.SELL, 99, 1.0, now); // Simply for triggering the batch publish.

  beforeEach(() => {
    const l2OrderFeed = new PubSub<Order>();
    l2OrderBook = new L2OrderBook(l2OrderFeed);
    paperFeed = new PubSub<Order>();
    batchedTradeFeed = new BatchedPubSub<Trade>(-1, undefined, (() => {
      let prevTimestamp: number | null = null;
      let prevPrice: number | null = null;
      return (trade) => {
        const timestampChanged = prevTimestamp !== null && trade.timestamp !== prevTimestamp;
        const movingInward = prevPrice !== null && (
          trade.side === Side.BUY ? trade.price > prevPrice : trade.price < prevPrice
        );
        const shouldPublish = timestampChanged || movingInward;
        prevTimestamp = trade.timestamp;
        prevPrice = trade.price;
        return shouldPublish;
      };
    })());

    world = new L2PGWorld(
      l2OrderBook,
      paperFeed,
      batchedTradeFeed,
      () => ReluctanceFactor.RELUCTANT,
      // Control the impedance factor each time.
      (() => {
        const values = [1.0, 0.0, 0.25];
        let i = 0;
        return () => i < 3 ? values[i++] : 0.0;
      })()
    );

    paperFeed.publish(paperX);
    paperFeed.publish(ghostM);
    paperFeed.publish(ghost0);
    paperFeed.publish(paperP);
    paperFeed.publish(ghostP);
    paperFeed.publish(ghostF);
    paperFeed.publish(paperF);
  });

  it('should process a batch of trades', () => {

    trade107 = new Trade(Side.SELL, 107, 2.0, now);

    batchedTradeFeed.publish(trade100);
    batchedTradeFeed.publish(trade102a);
    batchedTradeFeed.publish(trade102b);
    batchedTradeFeed.publish(trade103a);
    batchedTradeFeed.publish(trade103b);
    batchedTradeFeed.publish(trade104a);
    batchedTradeFeed.publish(trade104b);
    batchedTradeFeed.publish(trade107);
    batchedTradeFeed.publish(trade108a);
    batchedTradeFeed.publish(trade108b);
    batchedTradeFeed.publish(trade99);
    // TODO: Add assertions once the implementation is complete
  });
}); 