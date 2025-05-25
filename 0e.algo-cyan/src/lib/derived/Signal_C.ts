import { AssetPair } from "../base/Asset";
import { Interval } from "../base/Interval";
import { ANWave } from "../base/Wavelets";
import { DSignalAdapter } from "../infra/signals/DSignal";
import { Signal } from "../infra/signals/Signal";

export class Signal_C<A extends AssetPair, I extends Interval> extends DSignalAdapter<number, I>
{
  private _last: ANWave<A> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(source: Signal<any, ANWave<A>>, interval: I) {
    super(source, interval);
  }

  protected onNewInterval(signal: ANWave<A>): void {
    if (this._last) {
      this.broadcast(new ANWave<A>(this._last.value, this._intervalEndTimestamp));
    }
    this._last = signal;
  }

  protected onCurrentInterval(signal: ANWave<A>): void {
    this._last = signal;
  }
}