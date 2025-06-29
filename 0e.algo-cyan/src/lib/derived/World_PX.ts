import { Account, Wallet } from "../base/Account";
import { Fund } from "../base/Funds";
import { Order } from "../base/Order";
import { WorldMaker } from "../base/World";
import { PubSub, ReadOnlyPubSub } from "../infra/PubSub";
import { PaperExchange } from "./PaperExchange";
import { Trade } from "../base/Trade";
import { DSignalTAdapter_Clock } from "../infra/signals/DSignal";
import { DSignal_OHLC } from "./DSignal_OHLC";
import { Interval } from "../base/Interval";
import { Quotes } from "../base/Quotes";
import { World_Singular } from "./World_Singular";
import { Variation } from "../base/Variations";
import { AssetPair } from "../base/Asset";

export class World_PX<A extends AssetPair, I extends Interval> extends World_Singular<A, I> {

  public readonly PX: PaperExchange<A>;

  constructor(
    assetPair: A,
    interval: I,
    exchange: PaperExchange<A>
  ) {
    super(assetPair, interval);
    this.PX = exchange;
    this.addExchange(exchange);
  }
}

export class WorldMaker_PX<A extends AssetPair, I extends Interval> implements WorldMaker<World_PX<A, I>> {

  protected readonly _assetPair: A;
  protected readonly _interval: I;
  protected readonly _orderFeed: ReadOnlyPubSub<Order<A>>;
  protected readonly _tradeFeed: ReadOnlyPubSub<Trade<A>>;
  protected readonly _sigClock: DSignalTAdapter_Clock<number, I>;
  protected readonly _sigOHLC: DSignal_OHLC<A, I>;
  protected readonly _quotes: Quotes; // TODO(P1): Where do quotes belong?

  constructor(
    assetPair: A,
    interval: I,
    orderFeed: ReadOnlyPubSub<Order<A>>,
    tradeFeed: ReadOnlyPubSub<Trade<A>>,
    sigClock: DSignalTAdapter_Clock<number, I>,
    sigOHLC: DSignal_OHLC<A, I>,
    quotes: Quotes
  ) {
    this._assetPair = assetPair;
    this._interval = interval;
    this._orderFeed = orderFeed;
    this._tradeFeed = tradeFeed;
    this._sigClock = sigClock;
    this._sigOHLC = sigOHLC;
    this._quotes = quotes;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public make(variation: Variation): World_PX<A, I> {

    const paperFeed = new PubSub<Order<A>>();

    const exchange = new PaperExchange(
      this._assetPair,
      this._orderFeed,
      this._tradeFeed,
      paperFeed
    );

    const world = new World_PX(this._assetPair, this._interval, exchange);
    
    const account = new Account();
    const wallet = new Wallet();
    account.addWallet(wallet);
    wallet.depositAsset(new Fund(this._assetPair.quote, 10000000));
    wallet.depositAsset(new Fund(this._assetPair.base, 100));

    const quotes = new Quotes(this._assetPair.quote);
    this._tradeFeed.subscribe((trade) => {
      quotes.setQuote(this._assetPair, trade.price);
    });

    world.setQuotes(quotes);

    // TODO(P1): Should use exchange.combinedTradeFeed for realism.
    // TODO(P1): That's what would require it to be in here and not outside.
    // TODO(P1): But using common _tradeFeed to develop SignalPlant.
    world.addSigClock(this._sigClock);
    world.addSigOHLC(this._sigOHLC);
    
    return world;
  }
}