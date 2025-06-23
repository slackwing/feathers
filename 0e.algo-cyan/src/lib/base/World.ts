import { AssetPair } from "./Asset";
import { Firm } from "./Firm";
import { VirtualExchange } from "./VirtualExchange";
import { DSignalTAdapter_Clock } from "../infra/signals/DSignal";
import { DSignal_OHLC } from "../derived/DSignal_OHLC";
import { Quotes } from "./Quotes";
import { Variation } from "./Variations";

/* eslint-disable @typescript-eslint/no-explicit-any */
export class World {
  // These are private because they are carefully managed.
  private readonly _exchanges: VirtualExchange<any>[];
  private readonly _exchangesByAssetPair: Map<AssetPair, VirtualExchange<any>[]>;
  private readonly _firms: Set<Firm>;

  // TODO(P1): Eventually factor out into SignalPlant.
  public quotes: Quotes | null = null;
  public sigClock: DSignalTAdapter_Clock<any, any> | null = null;
  public sigOHLC: DSignal_OHLC<any, any> | null = null;

  constructor() {
    this._exchanges = [];
    this._exchangesByAssetPair = new Map();
    this._firms = new Set();
  }

  public get exchanges(): ReadonlyArray<VirtualExchange<any>> { return this._exchanges; }
  public get exchangesByAssetPair(): ReadonlyMap<AssetPair, VirtualExchange<any>[]> { return this._exchangesByAssetPair; }
  public get firms(): ReadonlySet<Firm> { return this._firms; }

  public addExchange(exchange: VirtualExchange<any>): void {
    this._exchanges.push(exchange);
    this._exchangesByAssetPair.set(
      exchange.assetPair,
      [...(this._exchangesByAssetPair.get(exchange.assetPair) || []), exchange]
    );
  }

  public addFirm(firm: Firm): void {
    this._firms.add(firm);
  }

  public setQuotes(quotes: Quotes): void {
    this.quotes = quotes;
  }

  public addSigClock(sigClock: DSignalTAdapter_Clock<any, any>): void {
    this.sigClock = sigClock;
  }

  // TODO(P1): Where does this belong?
  public addSigOHLC(sigOHLC: DSignal_OHLC<any, any>): void {
    this.sigOHLC = sigOHLC;
  }
}

export interface WorldMaker<W extends World> {
  make(variation: Variation): W;
}