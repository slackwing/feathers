import { AssetPair } from "../base/Asset";
import { Interval } from "../base/Interval";
import { OHLC, Stochastics } from "../base/Fields";
import { DSignal_Simple } from "../infra/signals/DSignal";
import { Wavelet } from "../infra/Wavelet";
import { DSignal_OHLC } from "./DSignal_OHLC";
import { AWave } from "../base/Wavelets";

export class AStochasticsWave<A extends AssetPair> extends AWave<A, Stochastics> {}

export class DSignal_FullStochastic<A extends AssetPair, I extends Interval> extends DSignal_Simple<OHLC, Stochastics, I> {

  private _kWindow: number;
  private _dWindow: number;
  private _k: number[];
  private _d: number[];

  constructor(interval: I, source: DSignal_OHLC<A, I>, kWindow: number, dWindow: number) {
    super(interval, source);
    if (kWindow < 1 || dWindow < 1) {
      throw new Error("kWindow and dWindow must be greater than 0.");
    }
    this._kWindow = kWindow;
    this._dWindow = dWindow;
    this._k = [];
    this._d = [];
  }

  protected onAlignment(values: Wavelet<OHLC>[]): void {
    const ohlc = values[0].value;
    const range = ohlc.h - ohlc.l;
    const fastK = range === 0 ? 50 : (ohlc.c - ohlc.l) / range * 100;
    const kWindowFull = this._k.length >= this._kWindow;
    if (kWindowFull) {
      this._k.shift();
    }
    this._k.push(fastK);
    if (kWindowFull) {
      const fastD = this._k.reduce((acc, curr) => acc + curr, 0) / this._kWindow;
      const dWindowFull = this._d.length >= this._dWindow;
      if (dWindowFull) {
        this._d.shift();
      }
      this._d.push(fastD);
      if (dWindowFull) {
        const slowD = this._d.reduce((acc, curr) => acc + curr, 0) / this._dWindow;
        this.broadcast(
          new AStochasticsWave<A>(
            new Stochastics(fastK, fastD, slowD),
            values[0].timestamp
          )
        );
      }
    }
  }
}