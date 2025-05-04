import React from 'react';
import styles from '../page.module.css';
import { OrderBook as OrderBookType } from '@/lib/base/OrderBook';

const X_BUCKET_WIDTH_USD = 1;
const X_BUCKETS_PER_SIDE = 50;
const MIN_Y_HEIGHT_VOLUME = 0.1;

export default function OrderBookBarChartDisplay({
    orderBook,
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    lastRefreshed
}: { orderBook: OrderBookType, lastRefreshed: number }) {
  const bids = orderBook.getTopBids(100);
  const asks = orderBook.getTopAsks(100);

  const [firstBid] = bids;
  const [firstAsk] = asks;

  if (!firstBid || !firstAsk) {
    return <div>Awaiting data to initialize bar chart...</div>;
  }

  const bestBid = firstBid.price;
  const bestAsk = firstAsk.price;
  const spread = bestAsk - bestBid;
  const spreadPercentage = (spread / bestBid) * 100;

  const bidBuckets = new Map();
  for (let i = 0; i < X_BUCKETS_PER_SIDE; i++) {
    const bucketPrice = Math.floor(bestBid / X_BUCKET_WIDTH_USD) * X_BUCKET_WIDTH_USD - (i * X_BUCKET_WIDTH_USD);
    bidBuckets.set(i, { price: bucketPrice, volume: 0 });
  }

  const askBuckets = new Map();
  for (let i = 0; i < X_BUCKETS_PER_SIDE; i++) {
    const bucketPrice = Math.floor(bestAsk / X_BUCKET_WIDTH_USD) * X_BUCKET_WIDTH_USD + (i * X_BUCKET_WIDTH_USD);
    askBuckets.set(i, { price: bucketPrice, volume: 0 });
  }

  for (const order of bids) {
    const bucketIndex = Math.floor((bestBid - order.price) / X_BUCKET_WIDTH_USD);
    if (bucketIndex >= X_BUCKETS_PER_SIDE) break;
    if (bucketIndex >= 0) {
      const bucket = bidBuckets.get(bucketIndex);
      if (bucket) {
        bucket.volume += order.quantity;
      }
    }
  }

  for (const order of asks) {
    const bucketIndex = Math.floor((order.price - bestAsk) / X_BUCKET_WIDTH_USD);
    if (bucketIndex >= X_BUCKETS_PER_SIDE) break;
    if (bucketIndex >= 0) {
      const bucket = askBuckets.get(bucketIndex);
      if (bucket) {
        bucket.volume += order.quantity;
      }
    }
  }

  let maxVolume = MIN_Y_HEIGHT_VOLUME;
  bidBuckets.forEach(bucket => {
    maxVolume = Math.max(maxVolume, bucket.volume);
  });
  askBuckets.forEach(bucket => {
    maxVolume = Math.max(maxVolume, bucket.volume);
  });

  return (
    <div className={styles.visualizationContainer}>
      <h2 className={styles.title}>Inside 100 Bids and Asks</h2>
      <div className={styles.visualization}>
        <div className={styles.volumeBars}>
          <div className={styles.bidsBars}>
            {Array.from(bidBuckets.entries()).map(([index, { volume }]) => {
              const height = (volume / maxVolume) * 100;
              return (
                <div key={index} className={styles.barContainer}>
                  <div className={`${styles.bar} ${styles.bidBar}`} style={{ height: `${height}%` }} />
                </div>
              );
            })}
          </div>
          <div className={styles.asksBars}>
            {Array.from(askBuckets.entries()).map(([index, { volume }]) => {
              const height = (volume / maxVolume) * 100;
              return (
                <div key={index} className={styles.barContainer}>
                  <div className={`${styles.bar} ${styles.askBar}`} style={{ height: `${height}%` }} />
                </div>
              );
            })}
          </div>
        </div>
        <div className={styles.spreadLine} />
        <div className={styles.spreadLabel}>
          Spread: ${spread.toFixed(2)} ({spreadPercentage.toFixed(3)}%)
        </div>
      </div>
    </div>
  );
} 