import { Timestamped } from "../base/Timestamped";

export class Wavelet<T> implements Timestamped { // TODO(P0): Need Timestamped?
  constructor(public readonly value: T, public readonly timestamp: number) {}
}