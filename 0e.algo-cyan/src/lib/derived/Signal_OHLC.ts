import { AssetPair } from "../base/Asset";
import { Interval } from "../base/Interval";
import { OHLC } from "../base/OHLC";
import { WaveletN, WaveletOHLC } from "../base/Wavelet";
import { Signal } from "../infra/Signal";
import { Signal_C } from "./Signal_C";
import { Signal_H } from "./Signal_H";
import { Signal_L } from "./Signal_L";
import { Signal_O } from "./Signal_O";

export class Signal_OHLC<A extends AssetPair, I extends Interval> extends Signal<WaveletN<A>, WaveletOHLC<A>> {
  private _signalO: Signal_O<A, I>;
  private _signalH: Signal_H<A, I>;
  private _signalL: Signal_L<A, I>;
  private _signalC: Signal_C<A, I>;
  private _o: WaveletN<A> | null = null;
  private _h: WaveletN<A> | null = null;
  private _l: WaveletN<A> | null = null;
  private _c: WaveletN<A> | null = null;
  private _currentTimestamp: number | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(source: Signal<any, WaveletN<A>>, interval: I) {
    super(source);
    this._signalO = new Signal_O(source, interval);
    this._signalH = new Signal_H(source, interval);
    this._signalL = new Signal_L(source, interval);
    this._signalC = new Signal_C(source, interval);
    this._o = null;
    this._h = null;
    this._l = null;
    this._c = null;
    this._signalO.subscribe((o) => this.shouldKeep(o) && (this._o = o) && this.maybePublish());
    this._signalH.subscribe((h) => this.shouldKeep(h) && (this._h = h) && this.maybePublish());
    this._signalL.subscribe((l) => this.shouldKeep(l) && (this._l = l) && this.maybePublish());
    this._signalC.subscribe((c) => this.shouldKeep(c) && (this._c = c) && this.maybePublish());
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected process(signal: WaveletN<A>): void {
    // Do nothing with the signal itself.
  }

  protected shouldKeep(signal: WaveletN<A>): boolean {
    if (!this._currentTimestamp || signal.timestamp > this._currentTimestamp) {
      this._o = null;
      this._h = null;
      this._l = null;
      this._c = null;
      this._currentTimestamp = signal.timestamp;
      return true;
    } else if (signal.timestamp < this._currentTimestamp) {
      return false;
    } else {
      return true;
    }
  }

  private maybePublish(): void {
    if (this._o && this._h && this._l && this._c && this._currentTimestamp) {
      this.publish(new WaveletOHLC<A>(new OHLC(this._o.value, this._h.value, this._l.value, this._c.value), this._currentTimestamp));
    }
  }
}