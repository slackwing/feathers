import { SimpleAgent } from "./SimpleAgent";
import { AssetPair } from "../base/Asset";
import { World } from "../base/World";
import { Interval } from "../base/Interval";
import { ReadOnlyPubSub } from "../infra/PubSub";
import { Execution } from "../base/Execution";
import { AStochasticsWave, DSignal_FullStochastic } from "./DSignal_FullStochastic";
import { ExchangeType, Order, OrderType, Side } from "../base/Order";
import { Quotes } from "../base/Quotes";
import assert from "assert";
import { IntelligenceV1Type } from "../base/Intelligence";
import { Variation } from "../base/Variations";
import { AgentMaker } from "../base/Agent";

const MARKET_TO_LIMIT_PCT = 5;

enum Position {
  FLAT,
  PENDING_FLAT,
  LONG,
  PENDING_LONG,
  SHORT,
  PENDING_SHORT
}

export class StochasticAgent<A extends AssetPair, I extends Interval> extends SimpleAgent<A> {

  public readonly interval: I;

  protected _executionFeed: ReadOnlyPubSub<Execution<A>> | null = null;
  protected _sigStochastic: DSignal_FullStochastic<A, I> | null = null;
  protected _quotes: Quotes | null = null;

  protected _threshold: number;
  protected _kWindow: number;
  protected _dWindow: number;
  protected _sWindow: number;
  protected _fixedQuantity: number;

  protected _bidOrder: Order<A> | null = null;
  protected _askOrder: Order<A> | null = null;
  protected _position: Position = Position.FLAT;
  protected _previousFastD: number | null = null;
  protected _previousSlowD: number | null = null;

  protected _unsubscribeStochastic: (() => void) | null = null;
  protected _unsubscribeExecution: (() => void) | null = null;

  constructor(
    assetPair: A,
    interval: I,
    world: World,
    threshold: number,
    kWindow: number,
    dWindow: number,
    sWindow: number,
    fixedQuantity: number,
    name?: string,
  ) {
    super(assetPair, world, name);
    this.interval = interval;
    this._threshold = threshold;
    this._kWindow = kWindow;
    this._dWindow = dWindow;
    this._sWindow = sWindow;
    this._fixedQuantity = fixedQuantity;
  }

  public procureResources(): void {
    super.procureResources();
    if (this._exchange) {
      this._executionFeed = this._exchange.executionFeed;
    }
    if (this.world.quotes) {
      this._quotes = this.world.quotes;
    }
    if (this.world.sigOHLC) {
      // TODO(P2): Get from SignalPlant.
      this._sigStochastic = new DSignal_FullStochastic(
        this.interval,
        this.world.sigOHLC,
        this._kWindow,
        this._dWindow,
        this._sWindow
      );
    }
  }

  public onWake(): void {
    this._unsubscribeStochastic = this._sigStochastic!.listen(this._onStochastic);
    this._unsubscribeExecution = this._executionFeed!.subscribe(this._onExecution);
  }

  public onSleep(): void {
    if (this._unsubscribeStochastic) {
      this._unsubscribeStochastic();
      this._unsubscribeStochastic = null;
    }
    if (this._unsubscribeExecution) {
      this._unsubscribeExecution();
      this._unsubscribeExecution = null;
    }
  }

  protected _onStochastic = (data: AStochasticsWave<A, I>): void => {
    const currentFastD = data.value.fastD;
    const currentSlowD = data.value.slowD;
    if (this._previousFastD !== null && this._previousSlowD !== null) {
      let intel = IntelligenceV1Type.NONE;
      if (this._previousSlowD < (100 - this._threshold) && this._previousSlowD > this._threshold &&
          (currentSlowD < (100 - this._threshold) || currentSlowD > this._threshold)) {
        intel = IntelligenceV1Type.PRESIGNAL;
      }
      const isCrossed = (currentFastD - currentSlowD) * (this._previousFastD - this._previousSlowD) < 0;
      if (!isCrossed) {
        this._intelFeed.publish({ type: intel });
        return;
      }
      // Intersection of line segments: f0 + (f1 - f0) * (s0 - f0) / ((f1 - f0) - (s1 - s0)).
      const crossingPointDenominator = ((currentFastD - this._previousFastD) - (currentSlowD - this._previousSlowD));
      assert.ok(crossingPointDenominator !== 0, "IMPOSSIBLE: crossingPointDenominator is 0.");
      const crossingPoint =
        this._previousFastD +
        (currentFastD - this._previousFastD) *
        (this._previousSlowD - this._previousFastD) / crossingPointDenominator;
      if (crossingPoint > (100 - this._threshold) && currentFastD < this._previousFastD) {
        if (this._position === Position.FLAT) {
          console.log("$$$ Stochastic(A): FastD crossed below SlowD; entering PENDING_SHORT.");
          this._position = Position.PENDING_SHORT;
          this._newOrder(Side.SELL);
          intel = IntelligenceV1Type.SIGNAL;
        } else if (this._position === Position.LONG) {
          console.log("$$$ Stochastic(B): FastD crossed below SlowD; entering PENDING_FLAT.");
          this._position = Position.PENDING_FLAT;
          this._newOrder(Side.SELL);
          intel = IntelligenceV1Type.UNSIGNAL;
        } else {
          intel = IntelligenceV1Type.OVERSIGNAL;
        }
      } else if (crossingPoint < this._threshold && currentFastD > this._previousFastD) {
        if (this._position === Position.FLAT) {
          console.log("$$$ Stochastic(C): FastD crossed above SlowD; entering PENDING_LONG.");
          this._position = Position.PENDING_LONG;
          this._newOrder(Side.BUY);
          intel = IntelligenceV1Type.SIGNAL;
        } else if (this._position === Position.SHORT) {
          console.log("$$$ Stochastic(D): FastD crossed above SlowD; entering PENDING_FLAT.");
          this._position = Position.PENDING_FLAT;
          this._newOrder(Side.BUY);
          intel = IntelligenceV1Type.UNSIGNAL;
        } else {
          intel = IntelligenceV1Type.OVERSIGNAL;
        }
      }
      this._intelFeed.publish({ type: intel });
    }
    this._previousFastD = currentFastD;
    this._previousSlowD = currentSlowD;
  };

  protected _newOrder(side: Side): void {
    if (side === Side.BUY) {
      this._bidOrder = new Order<A>(
        this.assetPair,
        this.firm!.primaryAccount,
        OrderType.PAPER,
        ExchangeType.LIMIT,
        Side.BUY,
        // TODO(P1): This doesn't check that the quote is for USD, just assumes.
        this._quotes!.getQuote(this.assetPair.base) * (1.0 + MARKET_TO_LIMIT_PCT / 100.0),
        this._fixedQuantity,
        Date.now()
      );
      this._exchange!.paperFeed.publish(this._bidOrder);
    } else {
      this._askOrder = new Order<A>(
        this.assetPair,
        this.firm!.primaryAccount,
        OrderType.PAPER,
        ExchangeType.LIMIT,
        Side.SELL,
        this._quotes!.getQuote(this.assetPair.base) * (1.0 - MARKET_TO_LIMIT_PCT / 100.0),
        this._fixedQuantity,
        Date.now()
      );
      this._exchange!.paperFeed.publish(this._askOrder);
    }
  }

  protected _onExecution = (execution: Execution<A>): void => {
    if (execution.buyOrder.id === this._bidOrder?.id) {
      if (execution.buyOrder.remainingQty === 0) {
        if (this._position === Position.PENDING_LONG) {
          // console.log("$$$ Stochastic: Bought! Entering LONG.");
          this._position = Position.LONG;
        } else if (this._position === Position.PENDING_FLAT) {
          // console.log("$$$ Stochastic: Bought! Entering FLAT.");
          this._position = Position.FLAT;
        } else {
          assert.ok(false, "IMPOSSIBLE: Position was " + this._position + " but bought.");
        }
      }
    } else if (execution.sellOrder.id === this._askOrder?.id) {
      if (execution.sellOrder.remainingQty === 0) {
        if (this._position === Position.PENDING_SHORT) {
          // console.log("$$$ Stochastic: Sold! Entering SHORT.");
          this._position = Position.SHORT;
        } else if (this._position === Position.PENDING_FLAT) {
          // console.log("$$$ Stochastic: Sold! Entering FLAT.");
          this._position = Position.FLAT;
        } else {
          assert.ok(false, "IMPOSSIBLE: Position was " + this._position + " but sold.");
        }
      }
    }
  }
}

export class StochasticAgentMaker<A extends AssetPair, I extends Interval> implements AgentMaker {

  public readonly assetPair: A;
  public readonly interval: I;

  constructor(assetPair: A, interval: I) {
    this.assetPair = assetPair;
    this.interval = interval;
  }

  make(world: World, variation: Variation): StochasticAgent<A, I> {
    return new StochasticAgent(
      this.assetPair,
      this.interval,
      world,
      variation.get('StochasticThresholdParam')!.value,
      variation.get('StochasticWindowParams')!.value.kPeriod,
      variation.get('StochasticWindowParams')!.value.dPeriod,
      variation.get('StochasticWindowParams')!.value.sPeriod,
      variation.get('FixedQuantityParam')!.value,
    );
  }
}