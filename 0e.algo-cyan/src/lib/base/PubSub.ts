export class PubSub<T> {
  private subscribers: ((data: T) => void)[] = [];

  public subscribe(callback: (data: T) => void): void {
    this.subscribers.push(callback);
  }

  public publish(data: T): void {
    this.subscribers.forEach((callback) => callback(data));
  }
}
