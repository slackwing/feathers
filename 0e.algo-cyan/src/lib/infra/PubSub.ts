export class PubSub<T> {
  private subscribers: Set<(data: T) => void>;

  constructor() {
    this.subscribers = new Set();
  }

  subscribe(callback: (data: T) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // TODO(P2): How to make PubSubs that are read-only to be passed around?
  publish(data: T): void {
    for (const callback of this.subscribers) {
      callback(data);
    }
  }
}
