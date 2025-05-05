"use client";

import React, { useEffect } from 'react';
import styles from './page.module.css';
import OrderBookTableDisplay from './components/OrderBookTableDisplay';
import OrderBookBarChartDisplay from './components/OrderBookBarChartDisplay';
import { CoinbaseWebSocketProvider } from './providers/CoinbaseWebSocketProvider';
import { useCoinbaseWebSocket } from './hooks/useCoinbaseWebSocket';
import { PubSub } from '@/lib/infra/PubSub';
import { L2OrderBook } from '@/lib/derived/L2OrderBook';
import { Order } from '@/lib/base/Order';
import { CoinbaseDataAdapter } from './adapters/CoinbaseDataAdapter';
import OrderForm from './components/OrderForm';
import { Side } from '@/lib/base/Order';
import { L2PGWorld } from '@/lib/derived/L2PGWorld';
// TODO(P3): Standardize all these import styles.

const Dashboard = () => {
  const { connect, disconnect } = useCoinbaseWebSocket();
  
  const [slowWorld, setSlowWorld] = React.useState<L2PGWorld | null>(null);
  const [fastWorld, setFastWorld] = React.useState<L2PGWorld | null>(null);
  const [lastRefreshed, setLastRefreshed] = React.useState(Date.now());
  const [paperOrderFeed, setPaperOrderFeed] = React.useState<PubSub<Order> | null>(null);

  useEffect(() => {
    const coinbaseAdapter = new CoinbaseDataAdapter();
    const l2OrderFeed = coinbaseAdapter.getL2OrderFeed();
    const tradeFeed = coinbaseAdapter.getTradeFeed();
    const paperFeed = new PubSub<Order>();
    setPaperOrderFeed(paperFeed);
    const l2OrderBook = new L2OrderBook(l2OrderFeed);
    setSlowWorld(new L2PGWorld(l2OrderBook, paperFeed, tradeFeed, 0.0));
    setFastWorld(new L2PGWorld(l2OrderBook, paperFeed, tradeFeed, 1.0));
    
    connect({
      onMessage: (data) => {
        coinbaseAdapter.onMessage(data);
        setLastRefreshed(Date.now());
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

  const handleOrderSubmit = (order: Order) => {
    if (paperOrderFeed) {
      paperOrderFeed.publish(order);
    }
  };

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
      
      {slowWorld ? (
        <OrderBookBarChartDisplay orderBook={slowWorld.combinedBook} lastRefreshed={lastRefreshed} />
      ) : (
        <div className={styles.loading}>Loading order book...</div>
      )}

      <div className={styles.orderEntry}>
        <div className={`${styles.orderPanel} ${styles.buy}`}>
          <h3>Buy BTC</h3>
          <OrderForm side={Side.BUY} onSubmit={handleOrderSubmit} />
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
          <OrderForm side={Side.SELL} onSubmit={handleOrderSubmit} />
        </div>
      </div>
      {slowWorld ? (
        <OrderBookTableDisplay orderBook={slowWorld.combinedBook} lastRefreshed={lastRefreshed} />
      ) : (
        <div className={styles.loading}>Loading order book...</div>
      )}
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
