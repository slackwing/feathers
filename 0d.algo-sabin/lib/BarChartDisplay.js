export class BarChartDisplay {
    constructor(bidsBarsContainer, asksBarsContainer, spreadLabel) {
        this.bidsBarsContainer = bidsBarsContainer;
        this.asksBarsContainer = asksBarsContainer;
        this.spreadLabel = spreadLabel;
        this.MIN_Y_HEIGHT_VOLUME = 0.1;
        this.X_BUCKET_WIDTH_USD = 1.0;
        this.X_BUCKETS_PER_SIDE = 100;
        this.yHeightVolume = this.MIN_Y_HEIGHT_VOLUME;
    }

    update(world) {
        let bestBid = null;
        let bestAsk = null;

        // Get best bid and ask using iterators
        const [firstBid] = world.book.bids;
        const [firstAsk] = world.book.asks;
        
        bestBid = firstBid?.price;
        bestAsk = firstAsk?.price;

        if (!bestBid || !bestAsk) {
            console.log('Awaiting data to initialize bar chart...');
            return;
        }
        
        const spread = bestAsk - bestBid;
        const spreadPercentage = (spread / bestBid) * 100;
        
        this.spreadLabel.textContent = `Spread: $${spread.toFixed(2)} (${spreadPercentage.toFixed(3)}%)`;
        
        const bucketSize = this.X_BUCKET_WIDTH_USD;
        const bucketsPerSide = this.X_BUCKETS_PER_SIDE;
        
        const bidBuckets = new Map();
        for (let i = 0; i < bucketsPerSide; i++) {
            const bucketPrice = Math.floor(bestBid / bucketSize) * bucketSize - (i * bucketSize);
            bidBuckets.set(i, { price: bucketPrice, volume: 0 });
        }
        
        const askBuckets = new Map();
        for (let i = 0; i < bucketsPerSide; i++) {
            const bucketPrice = Math.floor(bestAsk / bucketSize) * bucketSize + (i * bucketSize);
            askBuckets.set(i, { price: bucketPrice, volume: 0 });
        }

        for (const order of world.book.bids) {
            const bucketIndex = Math.floor((bestBid - order.price) / bucketSize);
            if (bucketIndex >= bucketsPerSide) break;
            if (bucketIndex >= 0) {
                const bucket = bidBuckets.get(bucketIndex);
                if (bucket) {
                    bucket.volume += order.quantity;
                }
            }
        }
        
        for (const order of world.book.asks) {
            const bucketIndex = Math.floor((order.price - bestAsk) / bucketSize);
            if (bucketIndex >= bucketsPerSide) break;
            if (bucketIndex >= 0) {
                const bucket = askBuckets.get(bucketIndex);
                if (bucket) {
                    bucket.volume += order.quantity;
                }
            }
        }

        let maxVolume = this.MIN_Y_HEIGHT_VOLUME;
        bidBuckets.forEach(bucket => {
            maxVolume = Math.max(maxVolume, bucket.volume);
        });
        askBuckets.forEach(bucket => {
            maxVolume = Math.max(maxVolume, bucket.volume);
        });
        this.yHeightVolume = maxVolume;

        const bidBars = Array.from(bidBuckets.entries())
            .map(([index, { volume }]) => {
                const height = (volume / this.yHeightVolume) * 100;
                return `<div class="bar-container">
                    <div class="bar bid-bar" style="height: ${height}%;"></div>
                </div>`;
            });
        
        const askBars = Array.from(askBuckets.entries())
            .map(([index, { volume }]) => {
                const height = (volume / this.yHeightVolume) * 100;
                return `<div class="bar-container">
                    <div class="bar ask-bar" style="height: ${height}%;"></div>
                </div>`;
            });
        
        this.bidsBarsContainer.innerHTML = bidBars.join('');
        this.asksBarsContainer.innerHTML = askBars.join('');
    }
} 