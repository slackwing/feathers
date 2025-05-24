import { AssetPair } from "../base/Asset";
import { Interval } from "../base/Interval";
import { NWave } from "../base/Wavelet";
import { Signal } from "../infra/Signal";
import { Signal_Bucketed } from "./Signal_Bucketed";

export class Signal_O<A extends AssetPair, I extends Interval> extends Signal_Bucketed<NWave<A>, NWave<A>, I>
{
  private _first: NWave<A> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(source: Signal<any, NWave<A>>, interval: I) {
    super(source, interval);
  }

  protected onNewBucket(signal: NWave<A>): void {
    if (this._first) {
      this.publish(new NWave<A>(this._first.value, this.bucketEndTimestamp));
    }
    this._first = signal;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onCurrentBucket(signal: NWave<A>): void {
    // Do nothing.
  }
}