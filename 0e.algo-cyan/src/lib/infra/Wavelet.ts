import { Timestamped } from "../base/Timestamped";

export class Wavelet<T> implements Timestamped { // TODO(P2): Need Timestamped?
  constructor(public readonly value: T, public readonly timestamp: number) {}
}