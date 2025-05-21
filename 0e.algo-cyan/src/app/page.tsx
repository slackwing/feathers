'use client';

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
import { L2PGWorld, ReluctanceFactor } from '@/lib/derived/L2PGWorld';
import { BatchedPubSub } from '@/lib/infra/BatchedPubSub';
import { getBatchingFn, Trade } from '@/lib/base/Trade';
import { BifurcatingPubSub } from '@/lib/infra/BifurcatingPubSub';
import { Account, Wallet } from '@/lib/base/Account';
import { Asset } from '@/lib/base/Asset';
import { Fund } from "@/lib/base/Funds";
import { MMStrat_StaticSpread } from '@/lib/derived/MMStrat_StaticSpread';
import { BTCUSD, BTCUSD_ } from '@/lib/derived/AssetPairs';
// TODO(P3): Standardize all these import styles.

const Dashboard = () => {
  const { connect, disconnect } = useCoinbaseWebSocket();

  const [slowWorld, setSlowWorld] = React.useState<L2PGWorld<BTCUSD> | null>(null);
  const [fastWorld, setFastWorld] = React.useState<L2PGWorld<BTCUSD> | null>(null);
  const [lastRefreshed, setLastRefreshed] = React.useState(Date.now());
  const [paperOrderFeed, setPaperOrderFeed] = React.useState<PubSub<Order<BTCUSD>> | null>(null);
  const [paperAccount, setPaperAccount] = React.useState<Account | null>(null);
  const [assetPair] = React.useState(new BTCUSD());

  useEffect(() => {
    const coinbaseAdapter = new CoinbaseDataAdapter(BTCUSD_);
    const l2OrderFeed = coinbaseAdapter.getL2OrderFeed();
    const tradeFeed = coinbaseAdapter.getTradeFeed();
    const batchedTradeFeed = new BatchedPubSub<Trade>(-1, undefined, getBatchingFn());
    tradeFeed.subscribe((trade) => batchedTradeFeed.publish(trade));
    const paperFeed = new BifurcatingPubSub<Order<BTCUSD>>();
    setPaperOrderFeed(paperFeed);
    const l2OrderBook = new L2OrderBook(BTCUSD_, l2OrderFeed);
    const paperAccount = new Account('paper', 'Paper Account');
    const paperWallet = new Wallet('paper', 'Paper Wallet');
    paperAccount.addWallet(paperWallet);
    paperWallet.depositAsset(new Fund(Asset.USD, 1000000000));
    paperWallet.depositAsset(new Fund(Asset.BTC, 1000));
    setPaperAccount(paperAccount);
    const sWorld = new L2PGWorld(
      BTCUSD_,
      l2OrderBook,
      paperFeed,
      batchedTradeFeed,
      paperAccount,
      () => ReluctanceFactor.RELUCTANT,
      () => 1.0
    );
    const fWorld = new L2PGWorld(
      BTCUSD_,
      l2OrderBook,
      paperFeed,
      batchedTradeFeed,
      paperAccount,
      () => ReluctanceFactor.AGGRESSIVE_LIMITED,
      () => 0.0
    );
    setSlowWorld(sWorld);
    setFastWorld(fWorld);

    // sWorld.executionFeed.subscribe((execution) => {
    //   console.log('Execution:', execution);
    // });

    const mmStrat = new MMStrat_StaticSpread(
      BTCUSD_,
      sWorld,
      paperAccount,
      sWorld.executionFeed,
      1,
      0.1
    );

    // TODO(P1): Do this properly.
    setTimeout(() => {
      mmStrat.start();
    }, 3000);

    connect({
      onMessage: (data) => {
        coinbaseAdapter.onMessage(data);
        setLastRefreshed(Date.now());
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
      },
      onOpen: () => {
        console.log('Connected to Coinbase.');
      },
    });

    return () => disconnect();
  }, []);

  const handleOrderSubmit = (order: Order<BTCUSD>) => {
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
        <button className={styles.powerButton} onClick={handlePowerOff}>
          Power Off
        </button>
        <div className={styles.status}>Connecting...</div>
      </div>

      {slowWorld ? (
        <OrderBookBarChartDisplay
          orderBook={slowWorld.combinedBook}
          lastRefreshed={lastRefreshed}
        />
      ) : (
        <div className={styles.loading}>Loading order book...</div>
      )}

      {fastWorld ? (
        <OrderBookBarChartDisplay
          orderBook={fastWorld.combinedBook}
          lastRefreshed={lastRefreshed}
        />
      ) : (
        <div className={styles.loading}>Loading order book...</div>
      )}

      <div className={styles.orderEntry}>
        <div className={`${styles.orderPanel} ${styles.buy}`}>
          <h3>Buy BTC</h3>
          {paperAccount && <OrderForm assetPair={assetPair} account={paperAccount} side={Side.BUY} onSubmit={handleOrderSubmit} />}
        </div>
        <div className={`${styles.orderPanel} ${styles.trades}`}>
          <div className={styles.plSection}>
            <div className={styles.plValue} id="pl-value">
              $0.00
            </div>
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
          {paperAccount && <OrderForm assetPair={assetPair} account={paperAccount} side={Side.SELL} onSubmit={handleOrderSubmit} />}
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
