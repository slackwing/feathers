import { ExchangeType, Order, OrderType, Side } from "../base/Order";
import { Account } from "../base/Account";
import { Strategy_SingleAsset } from "../base/Strategy_SingleAsset";
import { ReadOnlyPubSub } from "../infra/PubSub";
import { Execution } from "../base/Execution";
import { L2PaperWorld } from "./L2PaperWorld";
import { AssetPair } from "../base/Asset";

// MM = Market Making
export class MMStrat_StaticSpread<A extends AssetPair> extends Strategy_SingleAsset<A> {

  public paperAccount: Account;

  protected l2PaperWorld: L2PaperWorld<A>;
  protected executionFeed: ReadOnlyPubSub<Execution<A>>;
  protected spreadPips: number;
  protected fixedQuantity: number;

  protected bidOrder: Order<A> | null;
  protected askOrder: Order<A> | null;

  protected onExecution = (execution: Execution<A>): void => {
    if (execution.buyOrder.id === this.bidOrder?.id) {
      if (execution.buyOrder.remainingQty === 0) {
        console.log("StaticSpread: Bought! Entering new buy.");
        this.newOrder(Side.BUY);
      }
    } else if (execution.sellOrder.id === this.askOrder?.id) {
      if (execution.sellOrder.remainingQty === 0) {
        console.log("StaticSpread: Sold! Entering new sell.");
        this.newOrder(Side.SELL);
      }
    }
  }

  constructor(
    assetPair: A,
    l2PaperWorld: L2PaperWorld<A>,
    paperAccount: Account,
    executionFeed: ReadOnlyPubSub<Execution<A>>,
    spreadPips: number,
    fixedQuantity: number
  ) {
    super(assetPair, l2PaperWorld);
    this.l2PaperWorld = l2PaperWorld;
    this.paperAccount = paperAccount;
    this.executionFeed = executionFeed;
    this.spreadPips = spreadPips;
    this.fixedQuantity = fixedQuantity;
    this.bidOrder = null;
    this.askOrder = null;
  }

  public start(): void {
    if (!this.bidOrder) {
      this.newOrder(Side.BUY);
    }
    if (!this.askOrder) {
      this.newOrder(Side.SELL);
    }
    // Subscribe to the execution feed
    this.executionFeed.subscribe(this.onExecution);
  }

  protected newOrder(side: Side): void {
    const insideBid = this.world.combinedBook.getTopBids(1)[0].price;
    const insideAsk = this.world.combinedBook.getTopAsks(1)[0].price;
    const midpoint = (insideBid + insideAsk) / 2;
    const bidPrice = midpoint * (1 - this.spreadPips / 10000 / 2);
    const askPrice = midpoint * (1 + this.spreadPips / 10000 / 2);
    if (side === Side.BUY) {
      this.bidOrder = new Order<A>(
        this.assetPair,
        this.paperAccount,
        OrderType.PAPER,
        ExchangeType.LIMIT,
        Side.BUY, bidPrice,
        this.fixedQuantity,
        Date.now()
      );
      this.l2PaperWorld.paperFeed.publish(this.bidOrder);
    } else {
      this.askOrder = new Order<A>(
        this.assetPair,
        this.paperAccount,
        OrderType.PAPER,
        ExchangeType.LIMIT,
        Side.SELL, askPrice,
        this.fixedQuantity,
        Date.now()
      );
      this.l2PaperWorld.paperFeed.publish(this.askOrder);
    }
  }
}