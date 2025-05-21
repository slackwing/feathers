import { L2PGWorld, ReluctanceFactor } from './L2PGWorld';
import { L2OrderBook } from './L2OrderBook';
import { PubSub } from '../infra/PubSub';
import { BatchedPubSub } from '../infra/BatchedPubSub';
import { Order, Side, OrderType, ABSOLUTE_PRIORITY_TIMESTAMP, ExchangeType } from '../base/Order';
import { getBatchingFn, Trade } from '../base/Trade';
import { InfiniteAccount } from '../base/Account';
import { BTCUSD_, BTCUSD } from './AssetPairs';
describe('L2PGWorld', () => {

  let l2OrderBook: L2OrderBook<BTCUSD>;
  let paperFeed: PubSub<Order<BTCUSD>>;
  let batchedTradeFeed: BatchedPubSub<Trade>;
  let world: L2PGWorld<BTCUSD>;

  let paperX: Order<BTCUSD>;
  let ghostM: Order<BTCUSD>;
  let ghost0: Order<BTCUSD>;
  let paperP: Order<BTCUSD>;
  let ghostP: Order<BTCUSD>;
  let ghostF: Order<BTCUSD>;
  let paperF: Order<BTCUSD>;

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
    const l2OrderFeed = new PubSub<Order<BTCUSD>>();
    l2OrderBook = new L2OrderBook(BTCUSD_, l2OrderFeed);
    paperFeed = new PubSub<Order<BTCUSD>>();
    batchedTradeFeed = new BatchedPubSub<Trade>(-1, undefined, getBatchingFn());
    const account = new InfiniteAccount();

    world = new L2PGWorld(
      BTCUSD_,
      l2OrderBook,
      paperFeed,
      batchedTradeFeed,
      account,
      () => ReluctanceFactor.RELUCTANT,
      // Control the impedance factor each time.
      (() => {
        const values = [
          0.25, // For determining how much L2 is impeding.
          1.0, // For splitting up ghost orders at the final price level.
          0.4, // For splitting up ghost orders at an outer level.
          0.0 // For splitting up ghost orders at another outer level.
        ];
        let i = 0;
        return () => i < values.length ? values[i++] : 0.0;
      })()
    );

    paperX = new Order(BTCUSD_, account, OrderType.PAPER, ExchangeType.LIMIT, Side.SELL, 102, 2.0, Date.now());
    ghostM = new Order(BTCUSD_, account, OrderType.GHOST, ExchangeType.LIMIT, Side.SELL, 103, 4.0, Date.now());
    ghost0 = new Order(BTCUSD_, account, OrderType.GHOST, ExchangeType.LIMIT, Side.SELL, 104, 2.0, ABSOLUTE_PRIORITY_TIMESTAMP);
    paperP = new Order(BTCUSD_, account, OrderType.PAPER, ExchangeType.LIMIT, Side.SELL, 104, 1.0, Date.now() + 1000);
    ghostP = new Order(BTCUSD_, account, OrderType.PAPER, ExchangeType.LIMIT, Side.SELL, 104, 3.0, Date.now() + 2000);
    ghostF = new Order(BTCUSD_, account, OrderType.GHOST, ExchangeType.LIMIT, Side.SELL, 108, 1.0, ABSOLUTE_PRIORITY_TIMESTAMP);
    paperF = new Order(BTCUSD_, account, OrderType.PAPER, ExchangeType.LIMIT, Side.SELL, 108, 1.0, Date.now() + 1000);

    paperFeed.publish(paperX);
    paperFeed.publish(ghostM);
    paperFeed.publish(ghost0);
    paperFeed.publish(paperP);
    paperFeed.publish(ghostP);
    paperFeed.publish(ghostF);
    paperFeed.publish(paperF);
  });

  it('should process a batch of trades of quantity 19', () => {

    const additionalQty = 1.0;
    trade107 = new Trade(Side.SELL, 107, 1.0 + additionalQty, now);

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

    expect(paperX.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostM.remainingQty).toBe(0.0); // Fully executed.
    expect(ghost0.remainingQty).toBe(1.0); // Partially executed.
    expect(paperP.remainingQty).toBe(1.0);
    expect(ghostP.remainingQty).toBe(3.0);
    expect(ghostF.remainingQty).toBe(1.0);
    expect(paperF.remainingQty).toBe(1.0);

    const asks = world.combinedBook.getAsksUntil(110);
    expect(asks.length).toBe(9);
    expect(asks[0]).toBe(ghost0);
    expect(asks[1].price).toBe(104);
    expect(asks[1].quantity).toBe(2.0);
    expect(asks[1].type).toBe(OrderType.GHOST);
    expect(asks[1].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[2]).toBe(paperP);
    expect(asks[3]).toBe(ghostP);
    expect(asks[4].price).toBe(107);
    expect(asks[4].quantity).toBe(0.8);
    expect(asks[4].type).toBe(OrderType.GHOST);
    expect(asks[4].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[5].price).toBe(107);
    expect(asks[5].quantity).toBe(1.2);
    expect(asks[5].type).toBe(OrderType.GHOST);
    expect(asks[5].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[6]).toBe(ghostF);
    expect(asks[7].price).toBe(108);
    expect(asks[7].quantity).toBe(3);
    expect(asks[7].type).toBe(OrderType.GHOST);
    expect(asks[7].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[8]).toBe(paperF);
  });

  it('should process a batch of trades of quantity 20', () => {

    const additionalQty = 2.0;
    trade107 = new Trade(Side.SELL, 107, 1.0 + additionalQty, now);

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

    expect(paperX.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostM.remainingQty).toBe(0.0); // Fully executed.
    expect(ghost0.remainingQty).toBe(0.0); // Fully executed.
    expect(paperP.remainingQty).toBe(1.0);
    expect(ghostP.remainingQty).toBe(3.0);
    expect(ghostF.remainingQty).toBe(1.0);
    expect(paperF.remainingQty).toBe(1.0);

    const asks = world.combinedBook.getAsksUntil(110);

    expect(asks.length).toBe(8);
    expect(asks[0].price).toBe(104);
    expect(asks[0].quantity).toBe(2.0);
    expect(asks[0].type).toBe(OrderType.GHOST);
    expect(asks[0].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[1]).toBe(paperP);
    expect(asks[2]).toBe(ghostP);
    expect(asks[3].price).toBe(107);
    expect(asks[3].quantity).toBe(1.2);
    expect(asks[3].type).toBe(OrderType.GHOST);
    expect(asks[3].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[4].price).toBe(107);
    expect(asks[4].quantity).toBe(1.8);
    expect(asks[4].type).toBe(OrderType.GHOST);
    expect(asks[4].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[5]).toBe(ghostF);
    expect(asks[6].price).toBe(108);
    expect(asks[6].quantity).toBe(3);
    expect(asks[6].type).toBe(OrderType.GHOST);
    expect(asks[6].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[7]).toBe(paperF);
  });

  it('should process a batch of trades of quantity 20.25', () => {

    const additionalQty = 2.25;
    trade107 = new Trade(Side.SELL, 107, 1.0 + additionalQty, now);

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

    expect(paperX.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostM.remainingQty).toBe(0.0); // Fully executed.
    expect(ghost0.remainingQty).toBe(0.0); // Fully executed.
    expect(paperP.remainingQty).toBe(1.0);
    expect(ghostP.remainingQty).toBe(3.0);
    expect(ghostF.remainingQty).toBe(1.0);
    expect(paperF.remainingQty).toBe(1.0);

    const asks = world.combinedBook.getAsksUntil(110);

    expect(asks.length).toBe(8);
    expect(asks[0].price).toBe(104);
    expect(asks[0].quantity).toBe(1.75);
    expect(asks[0].type).toBe(OrderType.GHOST);
    expect(asks[0].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[1]).toBe(paperP);
    expect(asks[2]).toBe(ghostP);
    expect(asks[3].price).toBe(107);
    expect(asks[3].quantity).toBe(1.30);
    expect(asks[3].type).toBe(OrderType.GHOST);
    expect(asks[3].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[4].price).toBe(107);
    expect(asks[4].quantity).toBe(1.95);
    expect(asks[4].type).toBe(OrderType.GHOST);
    expect(asks[4].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[5]).toBe(ghostF);
    expect(asks[6].price).toBe(108);
    expect(asks[6].quantity).toBe(3);
    expect(asks[6].type).toBe(OrderType.GHOST);
    expect(asks[6].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[7]).toBe(paperF);
  });

  it('should process a batch of trades of quantity 20.5', () => {

    const additionalQty = 2.5;
    trade107 = new Trade(Side.SELL, 107, 1.0 + additionalQty, now);

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

    expect(paperX.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostM.remainingQty).toBe(0.0); // Fully executed.
    expect(ghost0.remainingQty).toBe(0.0); // Fully executed.
    expect(paperP.remainingQty).toBe(1.0);
    expect(ghostP.remainingQty).toBe(3.0);
    expect(ghostF.remainingQty).toBe(1.0);
    expect(paperF.remainingQty).toBe(1.0);

    const asks = world.combinedBook.getAsksUntil(110);

    expect(asks.length).toBe(8);
    expect(asks[0].price).toBe(104);
    expect(asks[0].quantity).toBe(1.5);
    expect(asks[0].type).toBe(OrderType.GHOST);
    expect(asks[0].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[1]).toBe(paperP);
    expect(asks[2]).toBe(ghostP);
    expect(asks[3].price).toBe(107);
    expect(asks[3].quantity).toBe(1.40);
    expect(asks[3].type).toBe(OrderType.GHOST);
    expect(asks[3].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[4].price).toBe(107);
    expect(asks[4].quantity).toBe(2.10);
    expect(asks[4].type).toBe(OrderType.GHOST);
    expect(asks[4].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[5]).toBe(ghostF);
    expect(asks[6].price).toBe(108);
    expect(asks[6].quantity).toBe(3);
    expect(asks[6].type).toBe(OrderType.GHOST);
    expect(asks[6].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[7]).toBe(paperF);
  });

  it('should process a batch of trades of quantity 21', () => {

    const additionalQty = 3.0;
    trade107 = new Trade(Side.SELL, 107, 1.0 + additionalQty, now);

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

    expect(paperX.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostM.remainingQty).toBe(0.0); // Fully executed.
    expect(ghost0.remainingQty).toBe(0.0); // Fully executed.
    expect(paperP.remainingQty).toBe(0.5); // Partially executed.
    expect(ghostP.remainingQty).toBe(3.0);
    expect(ghostF.remainingQty).toBe(1.0);
    expect(paperF.remainingQty).toBe(1.0);

    const asks = world.combinedBook.getAsksUntil(110);

    expect(asks.length).toBe(8);
    expect(asks[0].price).toBe(104);
    expect(asks[0].quantity).toBe(1.5);
    expect(asks[0].type).toBe(OrderType.GHOST);
    expect(asks[0].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[1]).toBe(paperP);
    expect(asks[2]).toBe(ghostP);
    expect(asks[3].price).toBe(107);
    expect(asks[3].quantity).toBe(1.60);
    expect(asks[3].type).toBe(OrderType.GHOST);
    expect(asks[3].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[4].price).toBe(107);
    expect(asks[4].quantity).toBe(2.40);
    expect(asks[4].type).toBe(OrderType.GHOST);
    expect(asks[4].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[5]).toBe(ghostF);
    expect(asks[6].price).toBe(108);
    expect(asks[6].quantity).toBe(3);
    expect(asks[6].type).toBe(OrderType.GHOST);
    expect(asks[6].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[7]).toBe(paperF);
  });

  it('should process a batch of trades of quantity 21.5', () => {

    const additionalQty = 3.5;
    trade107 = new Trade(Side.SELL, 107, 1.0 + additionalQty, now);

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

    expect(paperX.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostM.remainingQty).toBe(0.0); // Fully executed.
    expect(ghost0.remainingQty).toBe(0.0); // Fully executed.
    expect(paperP.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostP.remainingQty).toBe(3.0);
    expect(ghostF.remainingQty).toBe(1.0);
    expect(paperF.remainingQty).toBe(1.0);

    const asks = world.combinedBook.getAsksUntil(110);

    expect(asks.length).toBe(7);
    expect(asks[0].price).toBe(104);
    expect(asks[0].quantity).toBe(1.5);
    expect(asks[0].type).toBe(OrderType.GHOST);
    expect(asks[0].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[1]).toBe(ghostP);
    expect(asks[2].price).toBe(107);
    expect(asks[2].quantity).toBe(1.80);
    expect(asks[2].type).toBe(OrderType.GHOST);
    expect(asks[2].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[3].price).toBe(107);
    expect(asks[3].quantity).toBe(2.70);
    expect(asks[3].type).toBe(OrderType.GHOST);
    expect(asks[3].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[4]).toBe(ghostF);
    expect(asks[5].price).toBe(108);
    expect(asks[5].quantity).toBe(3);
    expect(asks[5].type).toBe(OrderType.GHOST);
    expect(asks[5].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[6]).toBe(paperF);
  });

  it('should process a batch of trades of quantity 22.0', () => {

    const additionalQty = 4.0;
    trade107 = new Trade(Side.SELL, 107, 1.0 + additionalQty, now);

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

    expect(paperX.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostM.remainingQty).toBe(0.0); // Fully executed.
    expect(ghost0.remainingQty).toBe(0.0); // Fully executed.
    expect(paperP.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostP.remainingQty).toBe(2.5); // Partially executed.
    expect(ghostF.remainingQty).toBe(1.0);
    expect(paperF.remainingQty).toBe(1.0);

    const asks = world.combinedBook.getAsksUntil(110);

    expect(asks.length).toBe(7);
    expect(asks[0].price).toBe(104);
    expect(asks[0].quantity).toBe(1.5);
    expect(asks[0].type).toBe(OrderType.GHOST);
    expect(asks[0].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[1]).toBe(ghostP);
    expect(asks[2].price).toBe(107);
    expect(asks[2].quantity).toBe(2.00);
    expect(asks[2].type).toBe(OrderType.GHOST);
    expect(asks[2].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[3].price).toBe(107);
    expect(asks[3].quantity).toBe(3.00);
    expect(asks[3].type).toBe(OrderType.GHOST);
    expect(asks[3].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[4]).toBe(ghostF);
    expect(asks[5].price).toBe(108);
    expect(asks[5].quantity).toBe(3);
    expect(asks[5].type).toBe(OrderType.GHOST);
    expect(asks[5].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[6]).toBe(paperF);
  });

  it('should process a batch of trades of quantity 24.5', () => {

    const additionalQty = 6.5;
    trade107 = new Trade(Side.SELL, 107, 1.0 + additionalQty, now);

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

    expect(paperX.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostM.remainingQty).toBe(0.0); // Fully executed.
    expect(ghost0.remainingQty).toBe(0.0); // Fully executed.
    expect(paperP.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostP.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostF.remainingQty).toBe(1.0);
    expect(paperF.remainingQty).toBe(1.0);

    const asks = world.combinedBook.getAsksUntil(110);

    expect(asks.length).toBe(6);
    expect(asks[0].price).toBe(104);
    expect(asks[0].quantity).toBe(1.5);
    expect(asks[0].type).toBe(OrderType.GHOST);
    expect(asks[0].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[1].price).toBe(107);
    expect(asks[1].quantity).toBe(3.00);
    expect(asks[1].type).toBe(OrderType.GHOST);
    expect(asks[1].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[2].price).toBe(107);
    expect(asks[2].quantity).toBe(4.50);
    expect(asks[2].type).toBe(OrderType.GHOST);
    expect(asks[2].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[3]).toBe(ghostF);
    expect(asks[4].price).toBe(108);
    expect(asks[4].quantity).toBe(3);
    expect(asks[4].type).toBe(OrderType.GHOST);
    expect(asks[4].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[5]).toBe(paperF);
  });

  it('should process a batch of trades of quantity 25.0', () => {

    const additionalQty = 7.0;
    trade107 = new Trade(Side.SELL, 107, 1.0 + additionalQty, now);

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

    expect(paperX.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostM.remainingQty).toBe(0.0); // Fully executed.
    expect(ghost0.remainingQty).toBe(0.0); // Fully executed.
    expect(paperP.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostP.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostF.remainingQty).toBe(1.0);
    expect(paperF.remainingQty).toBe(1.0);

    const asks = world.combinedBook.getAsksUntil(110);

    expect(asks.length).toBe(6);
    expect(asks[0].price).toBe(104);
    expect(asks[0].quantity).toBe(1.0);
    expect(asks[0].type).toBe(OrderType.GHOST);
    expect(asks[0].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[1].price).toBe(107);
    expect(asks[1].quantity).toBe(3.20);
    expect(asks[1].type).toBe(OrderType.GHOST);
    expect(asks[1].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[2].price).toBe(107);
    expect(asks[2].quantity).toBe(4.80);
    expect(asks[2].type).toBe(OrderType.GHOST);
    expect(asks[2].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[3]).toBe(ghostF);
    expect(asks[4].price).toBe(108);
    expect(asks[4].quantity).toBe(3);
    expect(asks[4].type).toBe(OrderType.GHOST);
    expect(asks[4].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[5]).toBe(paperF);
  });

  it('should process a batch of trades of quantity 25.5', () => {

    const additionalQty = 7.5;
    trade107 = new Trade(Side.SELL, 107, 1.0 + additionalQty, now);

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

    expect(paperX.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostM.remainingQty).toBe(0.0); // Fully executed.
    expect(ghost0.remainingQty).toBe(0.0); // Fully executed.
    expect(paperP.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostP.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostF.remainingQty).toBe(1.0);
    expect(paperF.remainingQty).toBe(1.0);

    const asks = world.combinedBook.getAsksUntil(110);

    expect(asks.length).toBe(6);
    expect(asks[0].price).toBe(104);
    expect(asks[0].quantity).toBe(0.5);
    expect(asks[0].type).toBe(OrderType.GHOST);
    expect(asks[0].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[1].price).toBe(107);
    expect(asks[1].quantity).toBe(3.40);
    expect(asks[1].type).toBe(OrderType.GHOST);
    expect(asks[1].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[2].price).toBe(107);
    expect(asks[2].quantity).toBe(5.10);
    expect(asks[2].type).toBe(OrderType.GHOST);
    expect(asks[2].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[3]).toBe(ghostF);
    expect(asks[4].price).toBe(108);
    expect(asks[4].quantity).toBe(3);
    expect(asks[4].type).toBe(OrderType.GHOST);
    expect(asks[4].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[5]).toBe(paperF);
  });

  it('should process a batch of trades of quantity 26.0', () => {

    const additionalQty = 8.0;
    trade107 = new Trade(Side.SELL, 107, 1.0 + additionalQty, now);

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

    expect(paperX.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostM.remainingQty).toBe(0.0); // Fully executed.
    expect(ghost0.remainingQty).toBe(0.0); // Fully executed.
    expect(paperP.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostP.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostF.remainingQty).toBe(1.0);
    expect(paperF.remainingQty).toBe(1.0);

    const asks = world.combinedBook.getAsksUntil(110);

    expect(asks.length).toBe(5);
    expect(asks[0].price).toBe(107);
    expect(asks[0].quantity).toBe(9.00);
    expect(asks[0].type).toBe(OrderType.GHOST);
    expect(asks[1]).toBe(ghostF);
    // In previous tests we were splitting the 107 level, but now it's the 108.
    expect(asks[2].price).toBe(108);
    expect(asks[2].quantity).toBe(1.20);
    expect(asks[2].type).toBe(OrderType.GHOST);
    expect(asks[2].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[3].price).toBe(108);
    expect(asks[3].quantity).toBe(1.80);
    expect(asks[3].type).toBe(OrderType.GHOST);
    expect(asks[3].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[4]).toBe(paperF);
  });

  it('should process a batch of trades of quantity 28.0', () => {

    // Adding any quantity beyond this point only offsets itself. Same result as above.

    const additionalQty = 10.0;
    trade107 = new Trade(Side.SELL, 107, 1.0 + additionalQty, now);

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

    expect(paperX.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostM.remainingQty).toBe(0.0); // Fully executed.
    expect(ghost0.remainingQty).toBe(0.0); // Fully executed.
    expect(paperP.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostP.remainingQty).toBe(0.0); // Fully executed.
    expect(ghostF.remainingQty).toBe(1.0);
    expect(paperF.remainingQty).toBe(1.0);

    const asks = world.combinedBook.getAsksUntil(110);

    expect(asks.length).toBe(5);
    expect(asks[0].price).toBe(107);
    expect(asks[0].quantity).toBe(9.00);
    expect(asks[0].type).toBe(OrderType.GHOST);
    //expect(asks[1]).toBe(ghostF);
    expect(asks[2].price).toBe(108);
    expect(asks[2].quantity).toBe(1.20);
    expect(asks[2].type).toBe(OrderType.GHOST);
    expect(asks[2].timestamp).toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    expect(asks[3].price).toBe(108);
    expect(asks[3].quantity).toBe(1.80);
    expect(asks[3].type).toBe(OrderType.GHOST);
    expect(asks[3].timestamp).not.toBe(ABSOLUTE_PRIORITY_TIMESTAMP);
    //expect(asks[4]).toBe(paperF);
  });
}); 