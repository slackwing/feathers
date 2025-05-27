import { DSignalTAdapter_WindowedMax } from "../infra/signals/DSignal";
import { TSignal } from "../infra/signals/TSignal";
import { Interval } from "../base/Interval";

/* eslint-disable @typescript-eslint/no-explicit-any */
export class DSignal_H<I extends Interval> extends DSignalTAdapter_WindowedMax<I> {

  constructor(interval: I, source: TSignal<any, number>, window: number) {
    super(interval, source, window);
  }
}
