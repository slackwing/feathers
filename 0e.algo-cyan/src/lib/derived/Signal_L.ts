import { AssetPair } from "../base/Asset";
import { Interval } from "../base/Interval";
import { WaveletN } from "../base/Wavelet";
import { Signal } from "../infra/Signal";
import { Signal_Bucketed } from "./Signal_Bucketed";

export class Signal_L<A extends AssetPair, I extends Interval> extends Signal_Bucketed<WaveletN<A>, WaveletN<A>, I>
{
  private _min: WaveletN<A> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(source: Signal<any, WaveletN<A>>, interval: I) {
    super(source, interval);
  }

  protected onNewBucket(signal: WaveletN<A>): void {
    if (this._min) {
      this.publish(new WaveletN<A>(this._min.value, this.bucketEndTimestamp));
    }
    this._min = signal;
  }

  protected onCurrentBucket(signal: WaveletN<A>): void {
    if (!this._min ||signal.value < this._min.value) {
      this._min = signal;
    }
  }
}