import { Signal } from "../infra/Signal";
import { Interval, toMilliseconds } from "../base/Interval";
import { Timestamped } from "../base/Timestamped";

export class Signal_Bucketed<T extends Timestamped, U, I extends Interval> extends Signal<T, U> {
  private _interval: I;
  private _intervalNumeric: number;
  private _beginProcessing: boolean;
  protected bucketEndTimestamp: number;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(source: Signal<any, T>, interval: I) {
    super(source);
    this._interval = interval;
    this._intervalNumeric = toMilliseconds(interval);
    this._beginProcessing = false;
    this.bucketEndTimestamp = 0;
  }

  protected process(signal: T): void {
    if (!this._beginProcessing) {
      if (this.bucketEndTimestamp === 0) {
        if (!this._interval.quantized) {
          this.bucketEndTimestamp = signal.timestamp + this._intervalNumeric;
          this._beginProcessing = true;
        } else {
          this.bucketEndTimestamp = signal.timestamp + (this._intervalNumeric - (signal.timestamp % this._intervalNumeric));
          // If quantized, don't begin processing until the next bucket.
        }
      } else if (this._interval.quantized && signal.timestamp > this.bucketEndTimestamp) {
        // If quantized, look out for passing to the next bucket to begin processing.
        this.bucketEndTimestamp += this._intervalNumeric;
        this._beginProcessing = true;
      }
    } else if (signal.timestamp > this.bucketEndTimestamp) {
      this.onNewBucket(signal);
      this.bucketEndTimestamp += this._intervalNumeric;
    } else {
      this.onCurrentBucket(signal);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onNewBucket(signal: T): void {
    // Override in subclass.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onCurrentBucket(signal: T): void {
    // Override in subclass.
  }
} 