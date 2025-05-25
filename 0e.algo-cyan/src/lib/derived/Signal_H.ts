import { AssetPair } from "../base/Asset";
import { Interval } from "../base/Interval";
import { ANWave } from "../base/Wavelets";
import { DSignalAdapter } from "../infra/signals/DSignal";
import { Signal } from "../infra/signals/Signal";

export class Signal_H<A extends AssetPair, I extends Interval> extends DSignalAdapter<number, I>
{
  private _max: ANWave<A> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(source: Signal<any, ANWave<A>>, interval: I) {
    super(source, interval);
  }

  protected onNewInterval(signal: ANWave<A>): void {
    if (this._max) {
      this.broadcast(new ANWave<A>(this._max.value, this._intervalEndTimestamp));
    }
    this._max = signal;
  }

  protected onCurrentInterval(signal: ANWave<A>): void {
    if (!this._max || signal.value > this._max.value) {
      this._max = signal;
    }
  }
}