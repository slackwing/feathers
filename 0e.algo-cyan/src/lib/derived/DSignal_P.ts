import { DSignalTAdapter_Last } from "../infra/signals/DSignal";
import { TSignal } from "../infra/signals/TSignal";
import { Interval } from "../base/Interval";

/* eslint-disable @typescript-eslint/no-explicit-any */
export class DSignal_P<I extends Interval> extends DSignalTAdapter_Last<number, I> {

  constructor(interval: I, source: TSignal<any, number>) {
    super(interval, source);
  }
}
