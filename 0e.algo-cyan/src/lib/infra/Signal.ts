/* eslint-disable @typescript-eslint/no-explicit-any */
import { PubSub } from "./PubSub";

export class Signal<T, U> {
  private _sourcePubSub: PubSub<T> | null = null;
  private _sourceSignal: Signal<any, T> | null = null;
  private _subscribers: Set<(data: U) => void>;

  constructor(source: PubSub<T> | Signal<any, T>) {
    if (source instanceof PubSub) {
      this._sourcePubSub = source;
      this._sourcePubSub.subscribe((signal: T) => {
        this.process(signal);
      });
    } else {
      this._sourceSignal = source;
      this._sourceSignal.subscribe((signal: T) => {
        this.process(signal);
      });
    }
    this._subscribers = new Set();
  }

  public subscribe(callback: (data: U) => void): () => void {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  protected publish(data: U): void {
    for (const callback of this._subscribers) {
      callback(data);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected process(signal: T): void {
    this.publish({} as U); // Override in subclass.
  }
}