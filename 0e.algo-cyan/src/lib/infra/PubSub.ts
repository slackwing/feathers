import { Signal } from "./signals/Signal";

export class ReadOnlyPubSub<T> extends Signal<T, T> {
  constructor() {
    super();
  }

  // Just an alias for listen in the PubSub context.
  public subscribe(callback: (data: T) => void): () => void {
    return this.listen(callback); // Returns a function to unsubscribe.
  }
}

export class PubSub<T> extends ReadOnlyPubSub<T> {
  constructor() {
    super();
  }

  // Just an alias for listen in the PubSub context.
  public publish(data: T): void {
    this.broadcast(data);
  }

  public asReadOnly(): ReadOnlyPubSub<T> {
    return this;
  }
}
