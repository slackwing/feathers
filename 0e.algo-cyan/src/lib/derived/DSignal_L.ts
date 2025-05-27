import { DSignalTAdapter_WindowedMin } from "../infra/signals/DSignal";
import { TSignal } from "../infra/signals/TSignal";
import { Interval } from "../base/Interval";

/* eslint-disable @typescript-eslint/no-explicit-any */
export class DSignal_L<I extends Interval> extends DSignalTAdapter_WindowedMin<I> {

  constructor(interval: I, source: TSignal<any, number>, window: number) {
    super(interval, source, window);
  }
}
