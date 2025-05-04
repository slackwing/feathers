import React, { useEffect } from 'react';
import styles from '../page.module.css';
import { OrderBook as OrderBookType } from '@/lib/base/OrderBook';
import { Order, Side, BookType } from '@/lib/base/Order';

export default function OrderBook({ orderBook, orderBookUpdated }: { orderBook: OrderBookType, orderBookUpdated: number }) {
  // Render the order book
  useEffect(() => {
    const bidsDiv = document.getElementById('bids');
    const asksDiv = document.getElementById('asks');
    if (!bidsDiv || !asksDiv) {
      console.log('Missing bids or asks div');
      return;
    }

    let bidsHtml = '';
    let asksHtml = '';
    let count = 0;

    const bids = Array.from(orderBook.getBids());
    for (const order of bids) {
      if (count >= 100) break;
      const isPaperOrder = order.book_type === BookType.PAPER;
      bidsHtml += `
        <div class="order-row">
          <span class="price">$${order.price.toFixed(2)}</span>
          <span class="quantity">
            ${isPaperOrder ? `<span style="color: #28a745">${order.quantity.toFixed(8)}</span>` : order.quantity.toFixed(8)}
          </span>
        </div>`;
      count++;
    }

    count = 0;
    const asks = Array.from(orderBook.getAsks());
    for (const order of asks) {
      if (count >= 100) break;
      const isPaperOrder = order.book_type === BookType.PAPER;
      asksHtml += `
        <div class="order-row">
          <span class="price">$${order.price.toFixed(2)}</span>
          <span class="quantity">
            ${isPaperOrder ? `<span style="color: #dc3545">${order.quantity.toFixed(8)}</span>` : order.quantity.toFixed(8)}
          </span>
        </div>`;
      count++;
    }

    bidsDiv.innerHTML = bidsHtml;
    asksDiv.innerHTML = asksHtml;
  }, [orderBookUpdated]);

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