import { AssetPair } from "../base/Asset";
import { Interval } from "../base/Interval";
import { ANWave } from "../base/Wavelets";
import { DSignalAdapter } from "../infra/signals/DSignal";
import { TSignal } from "../infra/signals/TSignal";

export class Signal_O<A extends AssetPair, I extends Interval> extends DSignalAdapter<number, I>
{
  protected _first: ANWave<A> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(source: TSignal<any, number>, interval: I) {
    super(source, interval);
  }

  protected onNewInterval(signal: ANWave<A>): void {
    if (this._first) {
      this.broadcast(new ANWave<A>(this._first.value, this._intervalEndTimestamp));
    }
    this._first = signal;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onCurrentInterval(signal: ANWave<A>): void {
    // Do nothing.
  }
}