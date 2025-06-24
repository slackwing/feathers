/* eslint-disable @typescript-eslint/no-explicit-any */
export class Signal<T, U> {
  protected readonly _sources: Signal<any, T>[];
  protected readonly _listeners: Set<(data: U) => void>;

  constructor(...sources: Signal<any, T>[]) {
    this._sources = sources;
    this._listeners = new Set();
    for (let i = 0; i < this._sources.length; i++) {
      this._sources[i].listen((data: T) => {
        this.process(i, data);
      });
    }
  }

  public listen(callback: (signal: U) => void): () => void {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  public broadcast(signal: U): void {
    for (const callback of this._listeners) {
      callback(signal);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected process(source: number, signal: T): void {
    // This method only applies to sources, which for example PubSubs don't use.
  }
}
