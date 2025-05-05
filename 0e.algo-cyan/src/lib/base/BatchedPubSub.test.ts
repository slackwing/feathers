import { BatchedPubSub } from './BatchedPubSub';

interface Trade {
    timestamp: number;
    price: number;
}

describe('BatchedPubSub', () => {
    let pubSub: BatchedPubSub<Trade>;
    let callback: jest.Mock;

    beforeEach(() => {
        jest.useFakeTimers();
        callback = jest.fn();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.clearAllMocks();
    });

    describe('basic functionality', () => {
        beforeEach(() => {
            pubSub = new BatchedPubSub<Trade>(10);
            pubSub.subscribe(callback);
        });

        it('should batch messages within timeout', () => {
            pubSub.publish({ timestamp: 0, price: 100 });
            pubSub.publish({ timestamp: 1, price: 101 });
            
            jest.advanceTimersByTime(10);
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith([
                { timestamp: 0, price: 100 },
                { timestamp: 1, price: 101 }
            ]);
        });

        it('should not publish before timeout', () => {
            pubSub.publish({ timestamp: 0, price: 100 });
            jest.advanceTimersByTime(5);
            expect(callback).not.toHaveBeenCalled();
        });

        it('should use minimum timeout of 5ms', () => {
            pubSub = new BatchedPubSub<Trade>(0);
            pubSub.subscribe(callback);
            
            pubSub.publish({ timestamp: 0, price: 100 });

            jest.advanceTimersByTime(3);
            expect(callback).not.toHaveBeenCalled();
            
            jest.advanceTimersByTime(5);
            expect(callback).toHaveBeenCalled();
        });
    });

    describe('with timestampFieldAccessor', () => {
        beforeEach(() => {
            pubSub = new BatchedPubSub<Trade>(10, (trade) => trade.timestamp);
            pubSub.subscribe(callback);
        });

        it('should publish when timestamp difference exceeds maxTimeout', () => {
            pubSub.publish({ timestamp: 0, price: 100 });
            pubSub.publish({ timestamp: 5, price: 101 });
            expect(callback).not.toHaveBeenCalled();
            
            pubSub.publish({ timestamp: 11, price: 102 });
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith([
                { timestamp: 0, price: 100 },
                { timestamp: 5, price: 101 },
                { timestamp: 11, price: 102 }
            ]);
        });

        it('should not publish on same timestamp with maxTimeout 0', () => {
            pubSub = new BatchedPubSub<Trade>(0, (trade) => trade.timestamp);
            pubSub.subscribe(callback);
            
            pubSub.publish({ timestamp: 0, price: 100 });
            pubSub.publish({ timestamp: 0, price: 101 });
            expect(callback).not.toHaveBeenCalled();

            jest.advanceTimersByTime(11);
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith([
                { timestamp: 0, price: 100 },
                { timestamp: 0, price: 101 }
            ]);
        });

        it('should handle multiple subscribers', () => {
            const callback2 = jest.fn();
            pubSub.subscribe(callback2);
            
            pubSub.publish({ timestamp: 0, price: 100 });
            pubSub.publish({ timestamp: 11, price: 101 });
            
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith([
                { timestamp: 0, price: 100 },
                { timestamp: 11, price: 101 }
            ]);
            expect(callback2).toHaveBeenCalledWith([
                { timestamp: 0, price: 100 },
                { timestamp: 11, price: 101 }
            ]);
        });
    });
}); 