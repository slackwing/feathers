import { Interval, TimeUnit } from "../base/Interval";

export class I1SQ extends Interval {
  constructor() {
    super(1, TimeUnit.SECOND, true);
  }
}
export const I1SQ_ = new I1SQ();

export class I15S extends Interval {
  constructor() {
    super(15, TimeUnit.SECOND);
  }
}
export const I15S_ = new I15S();

export class I15SQ extends Interval {
  constructor() {
    super(15, TimeUnit.SECOND, true);
  }
}
export const I15SQ_ = new I15SQ();

export class I15M extends Interval {
  constructor() {
    super(15, TimeUnit.MINUTE);
  }
}
export const I15M_ = new I15M();

// TODO(P1): Create more intervals.