import { Timestamped } from "@/lib/base/Timestamped";
import { Wavelet } from "../Wavelet";
import { Signal } from "./Signal";

/* eslint-disable @typescript-eslint/no-explicit-any */

export class TSignal<T, U> extends Signal<any, Wavelet<U>> {
  constructor(...sources: Signal<any, Wavelet<T>>[]) {
    super(...sources);
  }
}

/**
 * NOTE(UNUSED): Written because it seemed like it might be useful in the future.
 */
export class TSignalAdapter_UsingInstant<U> extends TSignal<any, U> {
  protected _source: Signal<any, U>;
  constructor(source: Signal<any, U>) {
    super();
    this._source = source;
    this._source.listen((data: U) => {
      this.broadcast(new Wavelet(data, Date.now()));
    });
  }
}

export class TSignalAdapter_UsingTimestamp<U extends Timestamped> extends TSignal<any, U> {
  protected _source: Signal<any, U>;
  constructor(source: Signal<any, U>) {
    super();
    this._source = source;
    this._source.listen((data: U) => {
      this.broadcast(new Wavelet(data, data.timestamp));
    });
  }
}
