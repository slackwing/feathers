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
    if (maxTimeout < 0 && maxTimeout !== -1) {
      throw new Error('maxTimeout must -1 or non-negative.');
    }
    this.maxTimeout = maxTimeout;
    this.shouldPublishBatchWith = shouldPublishBatchWith;
    this.shouldPublishBatchWithout = shouldPublishBatchWithout;
  }

  public subscribe(callback: (data: T[]) => void): void {
    this.subscribers.push(callback);
  }

  public publish(data: T): void {

    try {
      if (this.shouldPublishBatchWithout?.(data)) {
        if (this.currentTimeoutId) {
          clearTimeout(this.currentTimeoutId);
          this.currentTimeoutId = null;
        }
        this.publishBatch();
      }
    } catch (e) {
      console.error('Failed to publish batch: ', e);
    }

    this.batch.push(data);

    try {
      if (this.shouldPublishBatchWith?.(data)) {
        if (this.currentTimeoutId) {
          clearTimeout(this.currentTimeoutId);
          this.currentTimeoutId = null;
        }
        this.publishBatch();
        return;
      }
    } catch (e) {
      console.error('Failed to publish batch: ', e);
    }

    if (!this.currentTimeoutId && this.maxTimeout !== -1) {
      this.currentTimeoutId = setTimeout(
        () => {
          this.publishBatch();
          this.currentTimeoutId = null;
        },
        this.maxTimeout
      );
    }
  }

  private publishBatch(): void {
    // Should no longer be necessary since adding try-catch but just in case.
    if (this.batch.length === 0) return;
    const batch = this.batch;
    this.batch = [];
    this.subscribers.forEach((callback) => callback(batch));
  }
}
