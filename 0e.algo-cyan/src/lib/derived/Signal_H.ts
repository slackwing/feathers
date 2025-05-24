import { AssetPair } from "../base/Asset";
import { Interval } from "../base/Interval";
import { WaveletN } from "../base/Wavelet";
import { Signal } from "../infra/Signal";
import { Signal_Bucketed } from "./Signal_Bucketed";

export class Signal_H<A extends AssetPair, I extends Interval> extends Signal_Bucketed<WaveletN<A>, WaveletN<A>, I>
{
  private _max: WaveletN<A> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(source: Signal<any, WaveletN<A>>, interval: I) {
    super(source, interval);
  }

  protected onNewBucket(signal: WaWaveletNvelet<A>): void {
    if (this._max) {
      this.publish(new WaveletN<A>(this._max.value, this.bucketEndTimestamp));
    }
    this._max = signal;
  }

  protected onCurrentBucket(signal: WaveletN<A>): void {
    if (!this._max ||signal.value > this._max.value) {
      this._max = signal;
    }
  }
}