import { AssetPair } from "../base/Asset";
import { Interval } from "../base/Interval";
import { Order } from "../base/Order";
import { Quotes } from "../base/Quotes";
import { Trade } from "../base/Trade";
import { ReadOnlyPubSub } from "../infra/PubSub";
import { DSignalTAdapter_Clock } from "../infra/signals/DSignal";
import { DSignal_OHLC } from "./DSignal_OHLC";
import { WorldMaker_SimplePX } from "./World_SimplePX";

export class WorldMaker_L2PSA<A extends AssetPair, I extends Interval> extends WorldMaker_SimplePX<A, I> {

  private readonly _agentMaker: AgentMaker;

  constructor(
    assetPair: A,
    l2OrderFeed: ReadOnlyPubSub<Order<A>>,
    tradeFeed: ReadOnlyPubSub<Trade<A>>,
    sigClock: DSignalTAdapter_Clock<number, I>,
    sigOHLC: DSignal_OHLC<A, I>,
    quotes: Quotes,
    agentMaker: AgentMaker
  ) {
    super(assetPair, l2OrderFeed, tradeFeed, sigClock, sigOHLC, quotes);
    this._agentMaker = agentMaker;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  make(variation: Variation): World {
    const world = super.make(variation);
    const agent = this._agentMaker.make(variation);
    const firm = world.getFirm();
    firm.addAgent(agent);
    return world;
  }
}