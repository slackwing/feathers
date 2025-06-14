import { ExchangeType, Order, OrderType, Side } from "../base/Order";
import { Account } from "../base/Account";
import { Strategy_SingleAsset } from "../base/Strategy_SingleAsset";
import { PubSub, ReadOnlyPubSub } from "../infra/PubSub";
import { Execution } from "../base/Execution";
import { AssetPair } from "../base/Asset";
import { AStochasticsWave, DSignal_FullStochastic } from "./DSignal_FullStochastic";
import { Interval } from "../base/Interval";
import assert from "assert";
import { World_SimpleL2PaperMatching } from "./World_SimpleL2PaperMatching";
import { Quotes } from "../base/Quotes";
import { IntelligentV1 } from "./RunObservableV1";
import { IntelligenceV1, IntelligenceV1Type } from "../base/Intelligence";

export const MARKET_TO_LIMIT_PCT = 5;

export enum Position {
  FLAT,
  PENDING_FLAT,
  LONG,
  PENDING_LONG,
  SHORT,
  PENDING_SHORT
}

// MR = Momentum Reversal
export class MRStrat_Stochastic<A extends AssetPair, I extends Interval> extends Strategy_SingleAsset<A> implements IntelligentV1 {

  public paperAccount: Account;

  protected l2PaperWorld: World_SimpleL2PaperMatching<A>;
  protected executionFeed: ReadOnlyPubSub<Execution<A>>;
  protected stochasticSignal: DSignal_FullStochastic<A, I>;
  protected quotes: Quotes;

  protected intelligenceFeed: PubSub<IntelligenceV1>;

  protected threshold: number; // Typically 20 (meaning 80% for overbought, 20% for oversold).
  protected fixedQuantity: number;

  protected bidOrder: Order<A> | null;
  protected askOrder: Order<A> | null;
  protected position: Position;
  protected previousFastD: number | null;
  protected previousSlowD: number | null;

  protected onExecution = (execution: Execution<A>): void => {
    if (execution.buyOrder.id === this.bidOrder?.id) {
      if (execution.buyOrder.remainingQty === 0) {
        if (this.position === Position.PENDING_LONG) {
          // console.log("$$$ Stochastic: Bought! Entering LONG.");
          this.position = Position.LONG;
        } else if (this.position === Position.PENDING_FLAT) {
          // console.log("$$$ Stochastic: Bought! Entering FLAT.");
          this.position = Position.FLAT;
        } else {
          assert.ok(false, "IMPOSSIBLE: Position was " + this.position + " but bought.");
        }
      }
    } else if (execution.sellOrder.id === this.askOrder?.id) {
      if (execution.sellOrder.remainingQty === 0) {
        if (this.position === Position.PENDING_SHORT) {
          // console.log("$$$ Stochastic: Sold! Entering SHORT.");
          this.position = Position.SHORT;
        } else if (this.position === Position.PENDING_FLAT) {
          // console.log("$$$ Stochastic: Sold! Entering FLAT.");
          this.position = Position.FLAT;
        } else {
          assert.ok(false, "IMPOSSIBLE: Position was " + this.position + " but sold.");
        }
      }
    }
  }

  protected onStochastic: ((data: AStochasticsWave<A, I>) => void) | null = null;
  protected unsubscribeStochastic: (() => void) | null = null;
  protected unsubscribeExecution: (() => void) | null = null;

  public getIntelligenceFeed(): ReadOnlyPubSub<IntelligenceV1> {
    return this.intelligenceFeed;
  }

  constructor(
    assetPair: A,
    interval: I,
    l2PaperWorld: World_SimpleL2PaperMatching<A>,
    paperAccount: Account,
    executionFeed: ReadOnlyPubSub<Execution<A>>,
    stochasticSignal: DSignal_FullStochastic<A, I>,
    quotes: Quotes,
    threshold: number,
    fixedQuantity: number
  ) {
    super(assetPair, l2PaperWorld);
    this.l2PaperWorld = l2PaperWorld;
    this.paperAccount = paperAccount;
    this.executionFeed = executionFeed;
    this.stochasticSignal = stochasticSignal;
    this.quotes = quotes;
    this.intelligenceFeed = new PubSub<IntelligenceV1>();
    this.threshold = threshold;
    this.fixedQuantity = fixedQuantity;
    this.bidOrder = null;
    this.askOrder = null;
    this.position = Position.FLAT;
    this.previousFastD = null;
    this.previousSlowD = null;
  }

  public start(): void {
    this.onStochastic = (data: AStochasticsWave<A, I>) => {
      const currentFastD = data.value.fastD;
      const currentSlowD = data.value.slowD;
      if (this.previousFastD !== null && this.previousSlowD !== null) {
        let intel = IntelligenceV1Type.NONE;
        if (this.previousSlowD < (100 - this.threshold) && this.previousSlowD > this.threshold &&
            (currentSlowD < (100 - this.threshold) || currentSlowD > this.threshold)) {
          intel = IntelligenceV1Type.PRESIGNAL;
        }
        const isCrossed = (currentFastD - currentSlowD) * (this.previousFastD - this.previousSlowD) < 0;
        if (!isCrossed) {
          this.intelligenceFeed.publish({ type: intel });
          return;
        }
        // Intersection of line segments: f0 + (f1 - f0) * (s0 - f0) / ((f1 - f0) - (s1 - s0)).
        const crossingPointDenominator = ((currentFastD - this.previousFastD) - (currentSlowD - this.previousSlowD));
        assert.ok(crossingPointDenominator !== 0, "IMPOSSIBLE: crossingPointDenominator is 0.");
        const crossingPoint =
          this.previousFastD +
          (currentFastD - this.previousFastD) *
          (this.previousSlowD - this.previousFastD) / crossingPointDenominator;
        if (crossingPoint > (100 - this.threshold) && currentFastD < this.previousFastD) {
          if (this.position === Position.FLAT) {
            console.log("$$$ Stochastic(A): FastD crossed below SlowD; entering PENDING_SHORT.");
            this.position = Position.PENDING_SHORT;
            this._newOrder(Side.SELL);
            intel = IntelligenceV1Type.SIGNAL;
          } else if (this.position === Position.LONG) {
            console.log("$$$ Stochastic(B): FastD crossed below SlowD; entering PENDING_FLAT.");
            this.position = Position.PENDING_FLAT;
            this._newOrder(Side.SELL);
            intel = IntelligenceV1Type.UNSIGNAL;
          } else {
            intel = IntelligenceV1Type.OVERSIGNAL;
          }
        } else if (crossingPoint < this.threshold && currentFastD > this.previousFastD) {
          if (this.position === Position.FLAT) {
            console.log("$$$ Stochastic(C): FastD crossed above SlowD; entering PENDING_LONG.");
            this.position = Position.PENDING_LONG;
            this._newOrder(Side.BUY);
            intel = IntelligenceV1Type.SIGNAL;
          } else if (this.position === Position.SHORT) {
            console.log("$$$ Stochastic(D): FastD crossed above SlowD; entering PENDING_FLAT.");
            this.position = Position.PENDING_FLAT;
            this._newOrder(Side.BUY);
            intel = IntelligenceV1Type.UNSIGNAL;
          } else {
            intel = IntelligenceV1Type.OVERSIGNAL;
          }
        }
        this.intelligenceFeed.publish({ type: intel });
      }
      this.previousFastD = currentFastD;
      this.previousSlowD = currentSlowD;
    };
    this.unsubscribeStochastic = this.stochasticSignal.listen(this.onStochastic);
    this.unsubscribeExecution = this.executionFeed.subscribe(this.onExecution);
  }

  public stop(): void {
    if (this.unsubscribeStochastic) {
      this.unsubscribeStochastic();
      this.unsubscribeStochastic = null;
    }
    if (this.unsubscribeExecution) {
      this.unsubscribeExecution();
      this.unsubscribeExecution = null;
    }
  }

  protected _newOrder(side: Side): void {
    if (side === Side.BUY) {
      this.bidOrder = new Order<A>(
        this.assetPair,
        this.paperAccount,
        OrderType.PAPER,
        ExchangeType.LIMIT,
        Side.BUY,
        // TODO(P1): This doesn't check that the quote is for USD, just assumes.
        this.quotes.getQuote(this.assetPair.base) * (1.0 + MARKET_TO_LIMIT_PCT / 100.0),
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
        Side.SELL,
        this.quotes.getQuote(this.assetPair.base) * (1.0 - MARKET_TO_LIMIT_PCT / 100.0),
        this.fixedQuantity,
        Date.now()
      );
      this.l2PaperWorld.paperFeed.publish(this.askOrder);
    }
  }
}