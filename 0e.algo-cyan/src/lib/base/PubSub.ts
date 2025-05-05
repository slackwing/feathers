export class PubSub<T> {
    private subscribers: ((data: T) => void)[] = [];

    subscribe(callback: (data: T) => void): void {
        this.subscribers.push(callback);
    }

    publish(data: T): void {
        this.subscribers.forEach(callback => callback(data));
    }
} 