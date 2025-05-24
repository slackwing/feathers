import { AssetPair } from "../base/Asset";
import { Interval } from "../base/Interval";
import { WaveletN } from "../base/Wavelet";
import { Signal } from "../infra/Signal";
import { Signal_Bucketed } from "./Signal_Bucketed";

export class Signal_C<A extends AssetPair, I extends Interval> extends Signal_Bucketed<WaveletN<A>, WaveletN<A>, I>
{
  private _last: WaveletN<A> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(source: Signal<any, WaveletN<A>>, interval: I) {
    super(source, interval);
  }

  protected onNewBucket(signal: WaveletN<A>): void {
    if (this._last) {
      this.publish(new WaveletN<A>(this._last.value, this.bucketEndTimestamp));
    }
    this._last = signal;
  }

  protected onCurrentBucket(signal: WaveletN<A>): void {
    this._last = signal;
  }
}