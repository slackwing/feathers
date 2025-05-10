export class BatchedPubSub<T> {
  private subscribers: ((data: T[]) => void)[] = [];
  private maxTimeout: number;
  private batch: T[] = [];
  private currentTimeoutId: NodeJS.Timeout | null = null;
  // Pass in closures to track previous states, e.g. last trade timestamp.
  private shouldPublishBatchWith?: (item: T) => boolean;
  private shouldPublishBatchWithout?: (item: T) => boolean;

  constructor(
    maxTimeout: number,
    shouldPublishBatchWith?: (item: T) => boolean,
    shouldPublishBatchWithout?: (item: T) => boolean
  ) {
    if (maxTimeout < 0) {
      throw new Error('maxTimeout must non-negative');
    }
    this.maxTimeout = maxTimeout;
    this.shouldPublishBatchWith = shouldPublishBatchWith;
    this.shouldPublishBatchWithout = shouldPublishBatchWithout;
  }

  public subscribe(callback: (data: T[]) => void): void {
    this.subscribers.push(callback);
  }

  public publish(data: T): void {
    if (this.shouldPublishBatchWithout?.(data)) {
      if (this.currentTimeoutId) {
        clearTimeout(this.currentTimeoutId);
        this.currentTimeoutId = null;
      }
      this.publishBatch();
    }

    this.batch.push(data);

    if (this.shouldPublishBatchWith?.(data)) {
      if (this.currentTimeoutId) {
        clearTimeout(this.currentTimeoutId);
        this.currentTimeoutId = null;
      }
      this.publishBatch();
      return;
    }

    if (!this.currentTimeoutId) {
      this.currentTimeoutId = setTimeout(
        () => {
          this.publishBatch();
          this.currentTimeoutId = null;
        },
        Math.max(5, this.maxTimeout)
      );
    }
  }

  private publishBatch(): void {
    const batch = this.batch;
    this.batch = [];
    this.subscribers.forEach((callback) => callback(batch));
  }

  public getMaxTimeout(): number {
    return this.maxTimeout;
  }
}
