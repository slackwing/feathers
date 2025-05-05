import { BatchedPubSub } from './BatchedPubSub';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('BatchedPubSub', () => {
    let pubSub: BatchedPubSub<number>;
    let callback: jest.Mock;
    let callback2: jest.Mock;

    beforeEach(() => {
        jest.useFakeTimers();
        callback = jest.fn();
        callback2 = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('basic functionality', () => {
        beforeEach(() => {
            pubSub = new BatchedPubSub<number>(100);
            pubSub.subscribe(callback);
        });

        it('should batch multiple publishes within timeout', () => {
            pubSub.publish(1);
            pubSub.publish(2);
            pubSub.publish(3);

            expect(callback).not.toHaveBeenCalled();
            jest.advanceTimersByTime(100);
            expect(callback).toHaveBeenCalledWith([1, 2, 3]);
        });

        it('should handle multiple subscribers', () => {
            pubSub.subscribe(callback2);
            pubSub.publish(1);
            jest.advanceTimersByTime(100);
            expect(callback).toHaveBeenCalledWith([1]);
            expect(callback2).toHaveBeenCalledWith([1]);
        });
    });

    describe('timestamp-based batching', () => {
        beforeEach(() => {
            pubSub = new BatchedPubSub<number>(100, (item) => item);
        });

        it('should batch items within timestamp threshold', () => {
            pubSub.publish(1);
            pubSub.publish(2);
            pubSub.publish(3);
            jest.advanceTimersByTime(100);
            expect(callback).toHaveBeenCalledWith([1, 2, 3]);
        });

        it('should publish batch when timestamp threshold is exceeded', () => {
            pubSub.subscribe(callback);
            pubSub.publish(1);
            pubSub.publish(101); // Exceeds threshold
            expect(callback).toHaveBeenCalledWith([1]);
            jest.advanceTimersByTime(100);
            expect(callback).toHaveBeenCalledWith([101]);
        });
    });

    describe('error handling', () => {
        it('should throw error for negative timeout', () => {
            expect(() => new BatchedPubSub<number>(-1)).toThrow('maxTimeout must non-negative');
        });
    });
}); 