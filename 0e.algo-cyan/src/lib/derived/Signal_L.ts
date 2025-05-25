import { AssetPair } from "../base/Asset";
import { Interval } from "../base/Interval";
import { ANWave } from "../base/Wavelets";
import { DSignalAdapter } from "../infra/signals/DSignal";
import { Signal } from "../infra/signals/Signal";

export class Signal_L<A extends AssetPair, I extends Interval> extends DSignalAdapter<number, I>
{
  private _min: ANWave<A> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(source: Signal<any, ANWave<A>>, interval: I) {
    super(source, interval);
  }

  protected onNewInterval(signal: ANWave<A>): void {
    if (this._min) {
      this.broadcast(new ANWave<A>(this._min.value, this._intervalEndTimestamp));
    }
    this._min = signal;
  }

  protected onCurrentInterval(signal: ANWave<A>): void {
    if (!this._min || signal.value < this._min.value) {
      this._min = signal;
    }
  }
}