export class PubSub<T> {
  private subscribers: Set<(data: T) => void>;

  constructor() {
    this.subscribers = new Set();
  }

  subscribe(callback: (data: T) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  publish(data: T): void {
    for (const callback of this.subscribers) {
      callback(data);
    }
  }
} 