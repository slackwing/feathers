import React from 'react';
import styles from '../page.module.css';
import { OrderBook as OrderBookType } from '@/lib/base/OrderBook';
import { BookType } from '@/lib/base/Order';

export default function OrderBookTableDisplay({
  orderBook,
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  lastRefreshed,
}: {
  orderBook: OrderBookType;
  lastRefreshed: number;
}) {
  const bids = orderBook.getTopBids(100);
  const asks = orderBook.getTopAsks(100);

  return (
    <div className={styles.orderBook}>
      <div className={styles.bids}>
        <h2 className={styles.title}>Bids</h2>
        <div className={styles.headerRow}>
          <span>Price</span>
          <span>Size</span>
        </div>
        <div>
          {bids.map((order) => {
            const isPaperOrder = order.bookType === BookType.PAPER;
            return (
              <div className={styles.orderRow} key={order.id}>
                <span className={styles.price}>${order.price.toFixed(2)}</span>
                <span className={styles.quantity}>
                  {isPaperOrder ? (
                    <span style={{ color: '#28a745' }}>{order.remainingQty.toFixed(8)}</span>
                  ) : (
                    order.quantity.toFixed(8)
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className={styles.asks}>
        <h2 className={styles.title}>Asks</h2>
        <div className={styles.headerRow}>
          <span>Price</span>
          <span>Size</span>
        </div>
        <div>
          {asks.map((order) => {
            const isPaperOrder = order.bookType === BookType.PAPER;
            return (
              <div className={styles.orderRow} key={order.id}>
                <span className={styles.price}>${order.price.toFixed(2)}</span>
                <span className={styles.quantity}>
                  {isPaperOrder ? (
                    <span style={{ color: '#dc3545' }}>{order.remainingQty.toFixed(8)}</span>
                  ) : (
                    order.quantity.toFixed(8)
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
