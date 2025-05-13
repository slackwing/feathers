import React from 'react';
import styles from '../page.module.css';
import { OrderBook as OrderBookType } from '@/lib/base/OrderBook';
import { BookType } from '@/lib/base/Order';

const X_BUCKET_WIDTH_USD = 1;
const X_BUCKETS_PER_SIDE = 100;
const MIN_Y_HEIGHT_VOLUME = 0.1;

export default function OrderBookBarChartDisplay({
  orderBook,
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  lastRefreshed,
}: {
  orderBook: OrderBookType;
  lastRefreshed: number;
}) {
  const insideBid = orderBook.getTopBids(1).at(0);
  const insideAsk = orderBook.getTopAsks(1).at(0);

  if (!insideBid || !insideAsk) {
    return <div>Awaiting data to initialize bar chart...</div>;
  }

  const bids = orderBook.getBidsUntil(insideBid.price - X_BUCKET_WIDTH_USD * X_BUCKETS_PER_SIDE);
  const asks = orderBook.getAsksUntil(insideAsk.price + X_BUCKET_WIDTH_USD * X_BUCKETS_PER_SIDE);

  const bestBid = insideBid.price;
  const bestAsk = insideAsk.price;
  const spread = bestAsk - bestBid;
  const spreadPercentage = (spread / bestBid) * 100;

  const bidBuckets = new Map();
  for (let i = 0; i < X_BUCKETS_PER_SIDE; i++) {
    const bucketPrice =
      Math.floor(bestBid / X_BUCKET_WIDTH_USD) * X_BUCKET_WIDTH_USD - i * X_BUCKET_WIDTH_USD;
    bidBuckets.set(i, { price: bucketPrice, l2Volume: 0, paperVolume: 0, ghostVolume: 0 });
  }

  const askBuckets = new Map();
  for (let i = 0; i < X_BUCKETS_PER_SIDE; i++) {
    const bucketPrice =
      Math.floor(bestAsk / X_BUCKET_WIDTH_USD) * X_BUCKET_WIDTH_USD + i * X_BUCKET_WIDTH_USD;
    askBuckets.set(i, { price: bucketPrice, l2Volume: 0, paperVolume: 0, ghostVolume: 0 });
  }

  for (const order of bids) {
    const bucketIndex = Math.floor((bestBid - order.price) / X_BUCKET_WIDTH_USD);
    if (bucketIndex >= X_BUCKETS_PER_SIDE) break;
    if (bucketIndex >= 0) {
      const bucket = bidBuckets.get(bucketIndex);
      if (bucket) {
        switch (order.bookType) {
          case BookType.L2:
            bucket.l2Volume += order.remainingQty;
            break;
          case BookType.PAPER:
            bucket.paperVolume += order.remainingQty;
            break;
          case BookType.GHOST:
            bucket.ghostVolume += order.remainingQty;
            break;
        }
      }
    }
  }

  for (const order of asks) {
    const bucketIndex = Math.floor((order.price - bestAsk) / X_BUCKET_WIDTH_USD);
    if (bucketIndex >= X_BUCKETS_PER_SIDE) break;
    if (bucketIndex >= 0) {
      const bucket = askBuckets.get(bucketIndex);
      if (bucket) {
        switch (order.bookType) {
          case BookType.L2:
            bucket.l2Volume += order.remainingQty;
            break;
          case BookType.PAPER:
            bucket.paperVolume += order.remainingQty;
            break;
          case BookType.GHOST:
            bucket.ghostVolume += order.remainingQty;
            break;
        }
      }
    }
  }

  let maxVolume = MIN_Y_HEIGHT_VOLUME;
  bidBuckets.forEach((bucket) => {
    maxVolume = Math.max(maxVolume, bucket.l2Volume + bucket.paperVolume + bucket.ghostVolume);
  });
  askBuckets.forEach((bucket) => {
    maxVolume = Math.max(maxVolume, bucket.l2Volume + bucket.paperVolume + bucket.ghostVolume);
  });

  return (
    <div className={styles.visualizationContainer}>
      <h2 className={styles.title}>Inside 100 Bids and Asks</h2>
      <div className={styles.visualization}>
        <div className={styles.volumeBars}>
          <div className={styles.bidsBars}>
            {Array.from(bidBuckets.entries()).map(
              ([index, { l2Volume, paperVolume, ghostVolume }]) => {
                const l2Height = (l2Volume / maxVolume) * 100;
                const paperHeight = (paperVolume / maxVolume) * 100;
                const ghostHeight = (ghostVolume / maxVolume) * 100;
                return (
                  <div key={index} className={styles.barContainer}>
                    <div
                      className={`${styles.bar} ${styles.bidBar}`}
                      style={{ height: `${l2Height}%` }}
                    />
                    {ghostVolume > 0 && (
                      <div
                        className={`${styles.bar} ${styles.ghostBar}`}
                        style={{ height: `${ghostHeight}%` }}
                      />
                    )}
                    {paperVolume > 0 && (
                      <div
                        className={`${styles.bar} ${styles.paperBar}`}
                        style={{ height: `${paperHeight}%` }}
                      />
                    )}
                  </div>
                );
              }
            )}
          </div>
          <div className={styles.asksBars}>
            {Array.from(askBuckets.entries()).map(
              ([index, { l2Volume, paperVolume, ghostVolume }]) => {
                const l2Height = (l2Volume / maxVolume) * 100;
                const paperHeight = (paperVolume / maxVolume) * 100;
                const ghostHeight = (ghostVolume / maxVolume) * 100;
                return (
                  <div key={index} className={styles.barContainer}>
                    <div
                      className={`${styles.bar} ${styles.askBar}`}
                      style={{ height: `${l2Height}%` }}
                    />
                    {ghostVolume > 0 && (
                      <div
                        className={`${styles.bar} ${styles.ghostBar}`}
                        style={{ height: `${ghostHeight}%` }}
                      />
                    )}
                    {paperVolume > 0 && (
                      <div
                        className={`${styles.bar} ${styles.paperBar}`}
                        style={{ height: `${paperHeight}%` }}
                      />
                    )}
                  </div>
                );
              }
            )}
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
