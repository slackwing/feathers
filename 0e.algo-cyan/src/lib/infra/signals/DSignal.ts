import { Interval, toMilliseconds } from "@/lib/base/Interval";
import { Wavelet } from "../Wavelet";
import { Signal } from "./Signal";
import { TSignal } from "./TSignal";

/* eslint-disable @typescript-eslint/no-explicit-any */

export class DSignal<T, U, I extends Interval> extends Signal<any, Wavelet<U>> {

  protected _interval: I;
  private _values: Wavelet<T>[];
  private _currentInterval: number;

  constructor(interval: I, ...sources: DSignal<any, T, I>[]) {
    super(...sources);
    this._interval = interval;
    this._values = Array(this._sources.length).fill(null);
    this._currentInterval = 0;
  }

  protected process(source: number, signal: Wavelet<T>): void {
    if (this.shouldKeep(signal)) {
      this._values[source] = signal;
      if (this._values.every((value) => value !== null)) {
        this.onAlignment(this._values);
      }
    }
  }

  private shouldKeep(signal: Wavelet<T>): boolean {
    if (this._currentInterval === 0 || signal.timestamp > this._currentInterval) {
      this._values = Array(this._sources.length).fill(null);
      this._currentInterval = signal.timestamp;
      return true;
    } else if (signal.timestamp < this._currentInterval) {
      console.warn("Warning: Dropped wavelet in DSignal.");
      return false;
    } else {
      return true;
    }
  }

  /**
   * 
   * @param values Aligned values from each source in the order the sources were received.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onAlignment(values: Wavelet<T>[]): void {
    this.broadcast({} as Wavelet<U>); // Override in subclass.
  }
}

export class DSignalAdapter_Overlapping<U, I extends Interval> extends DSignal<any, U, I> {
  constructor(interval: I, source: TSignal<any, U>) {
    super(interval, source);
  }

  protected onAlignment(values: Wavelet<T>[]): void {
    this.broadcast({} as Wavelet<U>); // Override in subclass.
  }
}

export class DSignalAdapter_NonOverlapping<U, I extends Interval> extends DSignal<any, U, I> {
  
  protected _interval: I;
  protected _source: TSignal<any, U>;
  protected _intervalMs: number;
  protected _intervalEndTimestamp: number;
  protected _waitingForFirstInterval: boolean;

  constructor(interval: I, source: TSignal<any, U>) {
    super(interval);
    this._source = source;
    this._interval = interval;
    this._intervalMs = toMilliseconds(interval);
    this._intervalEndTimestamp = 0;
    this._waitingForFirstInterval = true;
    this._source.listen((data: Wavelet<U>) => {
      if (this._waitingForFirstInterval) {
        if (this._intervalEndTimestamp === 0) {
          if (!this._interval.quantized) {
            this._intervalEndTimestamp = data.timestamp + this._intervalMs;
            this._waitingForFirstInterval = false;
          } else {
            this._intervalEndTimestamp = data.timestamp + (this._intervalMs - (data.timestamp % this._intervalMs));
            // If quantized, don't begin processing until the next bucket.
          }
        } else if (this._interval.quantized && data.timestamp > this._intervalEndTimestamp) {
          // If quantized, look out for crossing the firs interval to begin processing.
          this._intervalEndTimestamp += this._intervalMs;
          this._waitingForFirstInterval = false;
        }
      } else if (data.timestamp > this._intervalEndTimestamp) {
        this.onNewInterval(data);
        this._intervalEndTimestamp += this._intervalMs;
      } else {
        this.onCurrentInterval(data);
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onNewInterval(data: Wavelet<U>): void {
    // Override in subclass.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onCurrentInterval(data: Wavelet<U>): void {
    // Override in subclass.
  }
}
