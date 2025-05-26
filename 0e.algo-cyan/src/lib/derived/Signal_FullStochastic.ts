import { AssetPair } from "../base/Asset";
import { Interval } from "../base/Interval";
import { OHLC } from "../base/OHLC";
import { DSignal_Simple } from "../infra/signals/DSignal_Simple";
import { Wavelet } from "../infra/Wavelet";
import { Signal_OHLC } from "./Signal_OHLC";

export class Signal_FullStochastic<A extends AssetPair, I extends Interval> extends DSignal_Simple<OHLC, number, I> {

  private _kWindow: number;
  private _dWindow: number;
  private _k: number[];
  private _d: number[];

  constructor(interval: I, source: Signal_OHLC<A, I>, kWindow: number, dWindow: number) {
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
    const k = (ohlc.c - ohlc.l) / (ohlc.h - ohlc.l) * 100;
    const kValid = this._k.length >= this._kWindow;
    if (kValid) {
      this._k.shift();
    }
    this._k.push(k);
    if (kValid) {
      const d = this._k.reduce((acc, curr) => acc + curr, 0) / this._kWindow;
      const dValid = this._d.length >= this._dWindow;
      if (dValid) {
        this._d.shift();
      }
      this._d.push(d);
    }
  }
}