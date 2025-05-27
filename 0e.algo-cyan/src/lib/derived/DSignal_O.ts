import { DSignalTAdapter_WindowedFirst } from "../infra/signals/DSignal";
import { TSignal } from "../infra/signals/TSignal";
import { Interval } from "../base/Interval";

/* eslint-disable @typescript-eslint/no-explicit-any */
export class DSignal_O<I extends Interval> extends DSignalTAdapter_WindowedFirst<I> {

  constructor(interval: I, source: TSignal<any, number>, window: number) {
    super(interval, source, window);
  }
}
