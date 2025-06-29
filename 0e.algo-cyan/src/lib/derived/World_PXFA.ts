import { AssetPair } from "../base/Asset";
import { FirmMaker } from "../base/Firm";
import { Interval } from "../base/Interval";
import { Order } from "../base/Order";
import { Quotes } from "../base/Quotes";
import { Trade } from "../base/Trade";
import { Variation } from "../base/Variations";
import { ReadOnlyPubSub } from "../infra/PubSub";
import { DSignalTAdapter_Clock } from "../infra/signals/DSignal";
import { DSignal_OHLC } from "./DSignal_OHLC";
import { PaperExchange } from "./PaperExchange";
import { World_PX, WorldMaker_PX } from "./World_PX";

export class World_PXFA<A extends AssetPair, I extends Interval> extends World_PX<A, I> {
  constructor(
    assetPair: A,
    interval: I,
    exchange: PaperExchange<A>
  ) {
    super(assetPair, interval, exchange);
  }
}

export class WorldMaker_PXFA<A extends AssetPair, I extends Interval> extends WorldMaker_PX<A, I> {

  protected readonly _firmMaker: FirmMaker;

  constructor(
    assetPair: A,
    interval: I,
    l2OrderFeed: ReadOnlyPubSub<Order<A>>,
    tradeFeed: ReadOnlyPubSub<Trade<A>>,
    sigClock: DSignalTAdapter_Clock<number, I>,
    sigOHLC: DSignal_OHLC<A, I>,
    quotes: Quotes,
    firmMaker: FirmMaker
  ) {
    super(assetPair, interval, l2OrderFeed, tradeFeed, sigClock, sigOHLC, quotes);
    this._firmMaker = firmMaker;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  make(variation: Variation): World_PXFA<A, I> {
    // Derived makers will tend to build upon the work of parent makers.
    const world = super.make(variation);
    const firm = this._firmMaker.make(world, variation);
    world.addFirm(firm);
    return world;
  }
}