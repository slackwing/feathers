import React from 'react';
import styles from '../page.module.css';

export default function OrderBook() {
  return (
    <div className={styles.orderBook}>
      <div className={styles.bids}>
        <h2 className={styles.title}>Bids</h2>
        <div className={styles.headerRow}>
          <span>Price</span>
          <span>Size</span>
        </div>
        <div id="bids"></div>
      </div>
      <div className={styles.asks}>
        <h2 className={styles.title}>Asks</h2>
        <div className={styles.headerRow}>
          <span>Price</span>
          <span>Size</span>
        </div>
        <div id="asks"></div>
      </div>
    </div>
  );
} 