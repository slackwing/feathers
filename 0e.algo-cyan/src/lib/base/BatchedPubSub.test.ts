import { BatchedPubSub } from './BatchedPubSub';

interface Trade {
    timestamp: number;
    price: number;
    potentialIceberg: boolean;
}

function customBatchWithFn() {
    return (trade: Trade) => trade.potentialIceberg;
}

function customPriceBatchWithoutFn() {
    let lastPrice: number | null = null;
    return (trade: Trade) => {
        if (lastPrice === null) {
            lastPrice = trade.price;
            return false;
        }
        const shouldPublish = trade.price !== lastPrice;
        if (shouldPublish) {
            lastPrice = trade.price;
        }
        return shouldPublish;
    };
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
            pubSub.publish({ timestamp: 0, price: 100, potentialIceberg: false });
            pubSub.publish({ timestamp: 1, price: 101, potentialIceberg: false });
            
            jest.advanceTimersByTime(10);
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith([
                { timestamp: 0, price: 100, potentialIceberg: false },
                { timestamp: 1, price: 101, potentialIceberg: false }
            ]);
        });

        it('should not publish before timeout', () => {
            pubSub.publish({ timestamp: 0, price: 100, potentialIceberg: false });
            jest.advanceTimersByTime(5);
            expect(callback).not.toHaveBeenCalled();
        });

        it('should use minimum timeout of 5ms', () => {
            pubSub = new BatchedPubSub<Trade>(0);
            pubSub.subscribe(callback);
            
            pubSub.publish({ timestamp: 0, price: 100, potentialIceberg: false });

            jest.advanceTimersByTime(3);
            expect(callback).not.toHaveBeenCalled();
            
            jest.advanceTimersByTime(5);
            expect(callback).toHaveBeenCalled();
        });
    });

    describe('with shouldPublishBatchWith', () => {
        beforeEach(() => {
            pubSub = new BatchedPubSub<Trade>(10, customBatchWithFn());
            pubSub.subscribe(callback);
        });

        it('should publish when potentialIceberg is true', () => {
            pubSub.publish({ timestamp: 0, price: 100, potentialIceberg: false });
            pubSub.publish({ timestamp: 5, price: 101, potentialIceberg: false });
            expect(callback).not.toHaveBeenCalled();
            
            pubSub.publish({ timestamp: 11, price: 102, potentialIceberg: true });
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith([
                { timestamp: 0, price: 100, potentialIceberg: false },
                { timestamp: 5, price: 101, potentialIceberg: false },
                { timestamp: 11, price: 102, potentialIceberg: true }
            ]);
        });

        it('should not publish when potentialIceberg is false', () => {
            pubSub = new BatchedPubSub<Trade>(0, customBatchWithFn());
            pubSub.subscribe(callback);
            
            pubSub.publish({ timestamp: 0, price: 100, potentialIceberg: false });
            pubSub.publish({ timestamp: 0, price: 101, potentialIceberg: false });
            expect(callback).not.toHaveBeenCalled();

            jest.advanceTimersByTime(11);
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith([
                { timestamp: 0, price: 100, potentialIceberg: false },
                { timestamp: 0, price: 101, potentialIceberg: false }
            ]);
        });
    });

    describe('with shouldPublishBatchWithout', () => {
        beforeEach(() => {
            pubSub = new BatchedPubSub<Trade>(10, undefined, customPriceBatchWithoutFn());
            pubSub.subscribe(callback);
        });

        it('should publish batch without current item when price changes', () => {
            pubSub.publish({ timestamp: 0, price: 100, potentialIceberg: false });
            pubSub.publish({ timestamp: 1, price: 100, potentialIceberg: false });
            expect(callback).not.toHaveBeenCalled();

            pubSub.publish({ timestamp: 2, price: 101, potentialIceberg: false });
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith([
                { timestamp: 0, price: 100, potentialIceberg: false },
                { timestamp: 1, price: 100, potentialIceberg: false }
            ]);
        });
    });

    describe('with both shouldPublishBatchWith and shouldPublishBatchWithout', () => {
        beforeEach(() => {
            pubSub = new BatchedPubSub<Trade>(
                10,
                customBatchWithFn(),
                customPriceBatchWithoutFn()
            );
            pubSub.subscribe(callback);
        });

        it('should handle both conditions', () => {
            // First batch: price change triggers publish without current item
            pubSub.publish({ timestamp: 0, price: 100, potentialIceberg: false });
            pubSub.publish({ timestamp: 1, price: 100, potentialIceberg: false });
            pubSub.publish({ timestamp: 2, price: 101, potentialIceberg: false });
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith([
                { timestamp: 0, price: 100, potentialIceberg: false },
                { timestamp: 1, price: 100, potentialIceberg: false }
            ]);

            // Second batch: potentialIceberg true triggers publish with current item
            pubSub.publish({ timestamp: 15, price: 101, potentialIceberg: true });
            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback).toHaveBeenCalledWith([
                { timestamp: 2, price: 101, potentialIceberg: false },
                { timestamp: 15, price: 101, potentialIceberg: true }
            ]);
        });
    });

    describe('multiple subscribers', () => {
        it('should handle multiple subscribers', () => {
            const callback2 = jest.fn();
            pubSub = new BatchedPubSub<Trade>(10);
            pubSub.subscribe(callback);
            pubSub.subscribe(callback2);
            
            pubSub.publish({ timestamp: 0, price: 100, potentialIceberg: false });
            pubSub.publish({ timestamp: 11, price: 101, potentialIceberg: false });
            
            jest.advanceTimersByTime(10);
            
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith([
                { timestamp: 0, price: 100, potentialIceberg: false },
                { timestamp: 11, price: 101, potentialIceberg: false }
            ]);
            expect(callback2).toHaveBeenCalledWith([
                { timestamp: 0, price: 100, potentialIceberg: false },
                { timestamp: 11, price: 101, potentialIceberg: false }
            ]);
        });
    });
}); 