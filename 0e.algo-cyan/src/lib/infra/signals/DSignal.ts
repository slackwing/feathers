import { Interval, toMilliseconds } from "@/lib/base/Interval";
import { Wavelet } from "../Wavelet";
import { Signal } from "./Signal";
import { TSignal } from "./TSignal";
import { DoublyLinkedList } from "@datastructures-js/linked-list";
import { eq } from "@/lib/utils/number";

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

export class DSignal_Simple<T, U, I extends Interval> extends DSignal<any, U, I> {

  constructor(interval: I, source: DSignal<any, T, I>) {
    super(interval, source);
  }

  // Single-source DSignals don't need to check for alignment.
  protected process(source: number, signal: Wavelet<T>): void {
    this.onAlignment([signal]);
  }
}

/**
 * NOTE(DECOMMISSIONED): This adapter chunks a TSignal into intervals, leaving
 * the deriving class to decide how to handle data coming in through
 * onNewInterval() and onCurrentInterval(). This should be considered canonical
 * and may still be useful in the future, but for present purposes it was
 * realized that a specialized adapter with a "memory" for rolling windows would
 * perform more efficiently.
 */
export abstract class DSignalTAdapter<T, U, I extends Interval> extends DSignal<any, U, I> {
  
  protected readonly _interval: I;
  protected readonly _source: TSignal<any, T>;
  private readonly _intervalMs: number;

  private _intervalEndTimestamp: number;
  private _waitingForFirstInterval: boolean;

  constructor(interval: I, source: TSignal<any, T>) {
    super(interval);
    this._interval = interval;
    this._source = source;
    this._intervalMs = toMilliseconds(interval);
    this._intervalEndTimestamp = 0;
    this._waitingForFirstInterval = true;
    this._source.listen((data: Wavelet<T>) => {
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

  protected getIntervalEndTimestamp(): number {
    return this._intervalEndTimestamp;
  }

  protected abstract onNewInterval(data: Wavelet<T>): void;

  protected abstract onCurrentInterval(data: Wavelet<T>): void;
}

export class DSignalTAdapter_Clock<U, I extends Interval> extends DSignalTAdapter<U, boolean, I> {

  constructor(interval: I, source: TSignal<any, U>) {
    super(interval, source);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onNewInterval(data: Wavelet<U>): void {
      this.broadcast(new Wavelet(true, this.getIntervalEndTimestamp()));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onCurrentInterval(data: Wavelet<U>): void {
  }
}

export class DSignalTAdapter_Last<U, I extends Interval> extends DSignalTAdapter<U, U, I> {

  private _last: U | null = null;

  constructor(interval: I, source: TSignal<any, U>) {
    super(interval, source);
  }

  protected onNewInterval(data: Wavelet<U>): void {
    if (this._last !== null) {
      this.broadcast(new Wavelet(this._last, this.getIntervalEndTimestamp()));
    }
    this._last = data.value;
  }

  protected onCurrentInterval(data: Wavelet<U>): void {
    this._last = data.value;
  }
}

/**
 * NOTE(DECOMMISSIONED): See DSignalTAdapter. This is a logical extension that
 * simply groups data from each interval into an array. Alternate extensions
 * would be ones finding the min, max, and average of the data in each interval;
 * which would themselves be used for a windowed min/max/average filter. This is
 * a valid approach, but a more efficient, direct implementation was chosen
 * (see DSignalTAdapter_Rolling).
 */
export class DSignalTAdapter_Group<U, I extends Interval> extends DSignalTAdapter<U, U[], I> {

  private _group: U[];

  constructor(interval: I, source: TSignal<any, U>) {
    super(interval, source);
    this._group = [];
  }

  protected onNewInterval(data: Wavelet<U>): void {
    this.broadcast(new Wavelet(this._group, this.getIntervalEndTimestamp()));
    this._group = [data.value];
  }

  protected onCurrentInterval(data: Wavelet<U>): void {
    this._group.push(data.value);
  }
}

export abstract class DSignalTAdapter_RollingWindow<T, U, I extends Interval> extends DSignal<any, U, I> {
  
  protected readonly _interval: I;
  protected readonly _source: TSignal<any, T>;
  private readonly _intervalMs: number;
  protected readonly _window: number;
  private readonly _windowMs: number;

  private _intervalEndTimestamp: number;
  private _waitingForFirstInterval: boolean;
  protected _dataChain: DoublyLinkedList<Wavelet<T>>;

  constructor(interval: I, source: TSignal<any, T>, window: number) {
    super(interval);
    this._interval = interval;
    this._source = source;
    this._intervalMs = toMilliseconds(interval);
    this._window = window;
    this._windowMs = this._intervalMs * window;
    this._intervalEndTimestamp = 0;
    this._waitingForFirstInterval = true;
    this._dataChain = new DoublyLinkedList();
    this._source.listen((data: Wavelet<T>) => {
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
        this.onNewInterval();
        this._dataChain.insertLast(data);
        this.onInsert(data);
        this._intervalEndTimestamp += this._intervalMs;
        const windowStartMs = this._intervalEndTimestamp - this._windowMs;
        let head = this._dataChain.head();
        while (head !== undefined && head.getValue().timestamp < windowStartMs) {
          this._dataChain.removeFirst();
          this.onRemove(head.getValue());
          head = this._dataChain.head();
        }
      } else {
        this.onCurrentInterval();
        this._dataChain.insertLast(data);
        this.onInsert(data);
      }
    });
  }

  protected getIntervalEndTimestamp(): number {
    return this._intervalEndTimestamp;
  }

  protected abstract onNewInterval(): void;

  protected abstract onCurrentInterval(): void;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onInsert(data: Wavelet<T>): void {
    // Nothing by default; override to use for efficiency.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onRemove(data: Wavelet<T>): void {
    // Nothing by default; override to use for efficiency.
  }
}

export class DSignalTAdapter_WindowedMin<I extends Interval> extends DSignalTAdapter_RollingWindow<number, number, I> {

  private _min: number | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(interval: I, source: TSignal<any, number>, window: number) {
    super(interval, source, window);
  }

  protected onNewInterval(): void {
    if (this._min !== null) {
      this.broadcast(new Wavelet(this._min, this.getIntervalEndTimestamp()));
    }
  }

  protected onCurrentInterval(): void {
    // Nothing to do; incoming data handled by onInsert.
  }

  protected onInsert(data: Wavelet<number>): void {
    if (this._min === null || data.value < this._min) {
      this._min = data.value;
    }
  }

  protected onRemove(data: Wavelet<number>): void {
    if (eq(data.value, this._min!)) {
      // The previous minimum was already removed from the chain.
      this._min = null;
      this._dataChain.forEach((node) => {
        const value = node.getValue().value;
        if (this._min === null || value < this._min) {
          this._min = value;
        }
      });
    }
  }
}

export class DSignalTAdapter_WindowedMax<I extends Interval> extends DSignalTAdapter_RollingWindow<number, number, I> {

  private _max: number | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(interval: I, source: TSignal<any, number>, window: number) {
    super(interval, source, window);
  }

  protected onNewInterval(): void {
    if (this._max !== null) {
      this.broadcast(new Wavelet(this._max, this.getIntervalEndTimestamp()));
    }
  }

  protected onCurrentInterval(): void {
    // Nothing to do; incoming data handled by onInsert.
  }

  protected onInsert(data: Wavelet<number>): void {
    if (this._max === null || data.value > this._max) {
      this._max = data.value;
    }
  }

  protected onRemove(data: Wavelet<number>): void {
    if (eq(data.value, this._max!)) {
      // The previous maximum was already removed from the chain.
      this._max = null;
      this._dataChain.forEach((node) => {
        const value = node.getValue().value;
        if (this._max === null || value > this._max) {
          this._max = value;
        }
      });
    }
  }
}

/**
 * NOTE(UNUSED): Added preemptively but not yet used.
 */
export class DSignalTAdapter_WindowedAvg<I extends Interval> extends DSignalTAdapter_RollingWindow<number, number, I> {

  private _sum: number | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(interval: I, source: TSignal<any, number>, window: number) {
    super(interval, source, window);
  }

  protected onNewInterval(): void {
    if (this._sum !== null) {
      this.broadcast(new Wavelet(this._sum / this._window, this.getIntervalEndTimestamp()));
    }
    this._sum = null;
  }

  protected onCurrentInterval(): void {
    // Nothing to do; incoming data handled by onInsert.
  }

  protected onInsert(data: Wavelet<number>): void {
    if (this._sum === null) {
      this._sum = data.value;
    } else {
      this._sum += data.value;
    }
  }

  protected onRemove(data: Wavelet<number>): void {
    if (this._sum !== null) {
      this._sum -= data.value;
    }
  }
}

export class DSignalTAdapter_WindowedFirst<I extends Interval> extends DSignalTAdapter_RollingWindow<number, number, I> {

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(interval: I, source: TSignal<any, number>, window: number) {
    super(interval, source, window);
  }

  protected onNewInterval(): void {
    if (!this._dataChain.isEmpty()) {
      this.broadcast(new Wavelet(this._dataChain.head()!.getValue().value, this.getIntervalEndTimestamp()));
    }
  }

  protected onCurrentInterval(): void {
    // Nothing to do; first element is always head of the chain.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onInsert(data: Wavelet<number>): void {
    // Nothing to do; first element is always head of the chain.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onRemove(data: Wavelet<number>): void {
    // Nothing to do; first element is always head of the chain.
  }
}

/**
 * NOTE(DECOMISSIONED): The last value of a windowed signal is the same
 * regardless of window size and indeed if it weren't windowed at all.
 * Use DSignalTAdapter_Last.
 */
export class DSignalTAdapter_WindowedLast<I extends Interval> extends DSignalTAdapter_RollingWindow<number, number, I> {

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(interval: I, source: TSignal<any, number>, window: number) {
    super(interval, source, window);
  }

  protected onNewInterval(): void {
    if (!this._dataChain.isEmpty()) {
      this.broadcast(this._dataChain.tail()!.getValue());
    }
  }

  protected onCurrentInterval(): void {
    // Nothing to do; first element is always head of the chain.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onInsert(data: Wavelet<number>): void {
    // Nothing to do; first element is always head of the chain.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onRemove(data: Wavelet<number>): void {
    // Nothing to do; first element is always head of the chain.
  }
}
