export class BatchedPubSub<T> {
    private subscribers: ((data: T[]) => void)[] = [];
    private maxTimeout: number;
    private batch: T[] = [];
    private currentTimeoutId: NodeJS.Timeout | null = null;
    private timestampFieldAccessor?: (item: T) => number;
    private batchTimestamp: number | null = null;

    constructor(maxTimeout: number, timestampFieldAccessor?: (item: T) => number) {
        if (maxTimeout < 0) {
            throw new Error('maxTimeout must non-negative');
        }
        this.maxTimeout = maxTimeout;
        this.timestampFieldAccessor = timestampFieldAccessor;
    }

    public subscribe(callback: (data: T[]) => void): void {
        this.subscribers.push(callback);
    }

    public publish(data: T): void {
        this.batch.push(data);
        
        if (this.timestampFieldAccessor) {
            const currentTimestamp = this.timestampFieldAccessor(data);
            if (this.batchTimestamp === null) {
                this.batchTimestamp = currentTimestamp;
            } else if (Math.abs(currentTimestamp - this.batchTimestamp) > this.maxTimeout) {
                if (this.currentTimeoutId) {
                    clearTimeout(this.currentTimeoutId);
                    this.currentTimeoutId = null;
                }
                this.publishBatch();
                return;
            }
        }

        if (!this.currentTimeoutId) {
            this.currentTimeoutId = setTimeout(() => {
                this.publishBatch();
                this.currentTimeoutId = null;
            }, Math.max(5, this.maxTimeout));
        }
    }

    private publishBatch(): void {
        const batch = this.batch;
        this.batch = [];
        this.batchTimestamp = null;
        this.subscribers.forEach(callback => callback(batch));
    }
}
