export class BatchedPubSub<T> {
    private subscribers: ((data: T[]) => void)[] = [];
    private maxTimeout: number;
    private batch: T[] = [];
    private currentTimeoutId: NodeJS.Timeout | null = null;
    private timestampFieldAccessor?: (item: T) => number;
    private lastTimestamp: number | null = null;

    constructor(maxTimeout: number, timestampFieldAccessor?: (item: T) => number) {
        if (maxTimeout < 0) {
            throw new Error('maxTimeout must non-negative');
        }
        this.maxTimeout = maxTimeout;
        this.timestampFieldAccessor = timestampFieldAccessor;
    }

    subscribe(callback: (data: T[]) => void): void {
        this.subscribers.push(callback);
    }

    publish(data: T): void {
        this.batch.push(data);
        
        if (this.timestampFieldAccessor) {
            const currentTimestamp = this.timestampFieldAccessor(data);
            if (this.lastTimestamp === null) {
                this.lastTimestamp = currentTimestamp;
            } else if (Math.abs(currentTimestamp - this.lastTimestamp) >= this.maxTimeout) {
                if (this.currentTimeoutId) {
                    clearTimeout(this.currentTimeoutId);
                    this.currentTimeoutId = null;
                }
                this.publishBatch();
                this.lastTimestamp = currentTimestamp;
                return;
            }
        }

        if (!this.currentTimeoutId) {
            this.currentTimeoutId = setTimeout(() => {
                this.publishBatch();
                this.currentTimeoutId = null;
            }, Math.min(1, this.maxTimeout));
        }
    }

    private publishBatch(): void {
        const batch = this.batch;
        this.batch = [];
        this.subscribers.forEach(callback => callback(batch));
    }
}
