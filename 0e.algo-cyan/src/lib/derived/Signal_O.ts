import { AssetPair } from "../base/Asset";
import { Interval } from "../base/Interval";
import { WaveletN } from "../base/Wavelet";
import { Signal } from "../infra/Signal";
import { Signal_Bucketed } from "./Signal_Bucketed";

export class Signal_O<A extends AssetPair, I extends Interval> extends Signal_Bucketed<WaveletN<A>, WaveletN<A>, I>
{
  private _first: WaveletN<A> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(source: Signal<any, WaveletN<A>>, interval: I) {
    super(source, interval);
  }

  protected onNewBucket(signal: WaveletN<A>): void {
    if (this._first) {
      this.publish(new WaveletN<A>(this._first.value, this.bucketEndTimestamp));
    }
    this._first = signal;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onCurrentBucket(signal: WaveletN<A>): void {
    // Do nothing.
  }
}