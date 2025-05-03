"use client";

import React, { useEffect } from 'react';
import styles from './page.module.css';
import OrderBook from './components/OrderBook';
import { CoinbaseWebSocketProvider } from './providers/CoinbaseWebSocketProvider';
import { useCoinbaseWebSocket } from './hooks/useCoinbaseWebSocket';
import { PubSub } from '@/lib/infra/PubSub';
import { L2OrderBook } from '@/lib/derived/L2OrderBook';
import { Order } from '@/lib/base/Order';
import { L2PaperWorld } from '@/lib/derived/L2PaperWorld';
// TODO(P3): Standardize all these import styles.

const Dashboard = () => {
  const { connect, disconnect } = useCoinbaseWebSocket();

  useEffect(() => {
    const l2OrderFeed = new PubSub<Order>();
    const paperOrderFeed = new PubSub<Order>();
    const l2OrderBook = new L2OrderBook(l2OrderFeed);
    const slowWorld = new L2PaperWorld(l2OrderBook, paperOrderFeed);
    const fastWorld = new L2PaperWorld(l2OrderBook, paperOrderFeed);
    
    connect({
      onMessage: (data) => {
        console.log('Received:', data);
        // Handle trading data
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
      },
      onOpen: () => {
        console.log('Connected to Coinbase');
      }
    });

    return () => disconnect();
  }, []);

  const handlePowerOff = () => {
    disconnect();
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>BTC-USD Order Book</h1>
      <div className={styles.controls}>
        <button className={styles.powerButton} onClick={handlePowerOff}>Power Off</button>
        <div className={styles.status}>Connecting...</div>
      </div>
      
      <div className={styles.visualizationContainer}>
        <h2 className={styles.title}>Order Book Visualization</h2>
        <div className={styles.visualization}>
          <div className={styles.volumeBars}>
            <div className={styles.bidsBars} id="bids-bars"></div>
            <div className={styles.asksBars} id="asks-bars"></div>
          </div>
          <div className={styles.spreadLine}></div>
          <div className={styles.spreadLabel} id="spread-label">Spread: $0.00</div>
        </div>
      </div>

      <div className={styles.orderEntry}>
        <div className={`${styles.orderPanel} ${styles.buy}`}>
          <h3>Buy BTC</h3>
          <form className={styles.orderForm}>
            <div className={styles.formGroup}>
              <label htmlFor="buyOrderType">Order Type</label>
              <select id="buyOrderType">
                <option value="limit">Limit</option>
                <option value="market" disabled>Market</option>
                <option value="stop" disabled>Stop</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="buyPrice">Price (USD)</label>
              <input type="number" id="buyPrice" step="0.01" placeholder="Enter price" />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="buyAmount">Amount (BTC)</label>
              <input type="number" id="buyAmount" step="0.00000001" placeholder="Enter amount" />
            </div>
            <button type="submit" className={`${styles.orderButton} ${styles.buy}`}>Buy BTC</button>
          </form>
        </div>
        <div className={`${styles.orderPanel} ${styles.trades}`}>
          <div className={styles.plSection}>
            <div className={styles.plValue} id="pl-value">$0.00</div>
          </div>
          <div className={styles.tradesHeader}>
            <h3>Recent Trades</h3>
            <label className={styles.toggleLabel}>
              <span className={styles.toggleSwitch}>
                <input type="checkbox" id="showAllTrades" defaultChecked />
                <span className={styles.toggleSlider}></span>
              </span>
              <span id="toggleText">Show all trades</span>
            </label>
          </div>
          <div className={styles.tradesList} id="trades-list"></div>
        </div>
        <div className={`${styles.orderPanel} ${styles.sell}`}>
          <h3>Sell BTC</h3>
          <form className={styles.orderForm}>
            <div className={styles.formGroup}>
              <label htmlFor="sellOrderType">Order Type</label>
              <select id="sellOrderType">
                <option value="limit">Limit</option>
                <option value="market" disabled>Market</option>
                <option value="stop" disabled>Stop</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="sellPrice">Price (USD)</label>
              <input type="number" id="sellPrice" step="0.01" placeholder="Enter price" />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="sellAmount">Amount (BTC)</label>
              <input type="number" id="sellAmount" step="0.00000001" placeholder="Enter amount" />
            </div>
            <button type="submit" className={`${styles.orderButton} ${styles.sell}`}>Sell BTC</button>
          </form>
        </div>
      </div>
      
      <OrderBook />
    </div>
  );
};

export default function Page() {
  return (
    <CoinbaseWebSocketProvider>
      <Dashboard />
    </CoinbaseWebSocketProvider>
  );
}
