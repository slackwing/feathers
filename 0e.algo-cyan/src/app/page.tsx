'use client';

import React, { useEffect } from 'react';
import styles from './page.module.css';
import OrderBookTableDisplay from './components/OrderBookTableDisplay';
import OrderBookBarChartDisplay from './components/OrderBookBarChartDisplay';
import ExperimentResultsDisplay from './components/ExperimentResultsDisplay';
import { CoinbaseWebSocketProvider } from './providers/CoinbaseWebSocketProvider';
import { useCoinbaseWebSocket } from './hooks/useCoinbaseWebSocket';
import { PubSub, ReadOnlyPubSub } from '@/lib/infra/PubSub';
import { L2OrderBook } from '@/lib/derived/L2OrderBook';
import { Order } from '@/lib/base/Order';
import { CoinbaseDataAdapter } from './adapters/CoinbaseDataAdapter';
import OrderForm from './components/OrderForm';
import { Side } from '@/lib/base/Order';
import { L2PGWorld } from '@/lib/derived/L2PGWorld';
import { BatchedPubSub } from '@/lib/infra/BatchedPubSub';
import { getBatchingFn, Trade } from '@/lib/base/Trade';
import { Account, Wallet } from '@/lib/base/Account';
import { Asset } from '@/lib/base/Asset';
import { Fund } from "@/lib/base/Funds";
import { BTCUSD, BTCUSD_ } from '@/lib/derived/AssetPairs';
import { Quotes } from '@/lib/base/Quotes';
import { TSignal_P } from '@/lib/derived/TSignal_P';
import { Signal_Trade } from '@/lib/derived/Signal_Trade';
import { I1SQ_ } from '@/lib/derived/Intervals';
import { DSignal_OHLC } from '@/lib/derived/DSignal_OHLC';
import { DSignal_FullStochastic } from '@/lib/derived/DSignal_FullStochastic';
import { World_SimpleL2PaperMatching } from '@/lib/derived/World_SimpleL2PaperMatching';
import { MRStrat_Stochastic } from '@/lib/derived/MRStrat_Stochastic';
import { RunResult } from '@/lib/base/RunResult';
// TODO(P3): Standardize all these import styles.

const Dashboard = () => {
  const { connect, disconnect } = useCoinbaseWebSocket();

  const [slowWorld, setSlowWorld] = React.useState<L2PGWorld<BTCUSD> | null>(null);
  const [fastWorld, setFastWorld] = React.useState<L2PGWorld<BTCUSD> | null>(null);
  const [xWorld, setXWorld] = React.useState<World_SimpleL2PaperMatching<BTCUSD> | null>(null);
  const [lastRefreshed, setLastRefreshed] = React.useState(Date.now());
  const [paperOrderFeed, setPaperOrderFeed] = React.useState<PubSub<Order<BTCUSD>> | null>(null);
  const [paperAccount, setPaperAccount] = React.useState<Account | null>(null);
  const [assetPair] = React.useState(new BTCUSD());
  const [runResults, setRunResults] = React.useState<RunResult[]>([]);
  const [eventFeeds, setEventFeeds] = React.useState<ReadOnlyPubSub<boolean>[]>([]);
  const [quotes] = React.useState(new Quotes(Asset.USD));
  const [globalBaseValue, setGlobalBaseValue] = React.useState<number>(0);

  useEffect(() => {
    const coinbaseAdapter = new CoinbaseDataAdapter(BTCUSD_);
    const l2OrderFeed = coinbaseAdapter.getL2OrderFeed();
    const tradeFeed = coinbaseAdapter.getTradeFeed();
    const batchedTradeFeed = new BatchedPubSub<Trade<BTCUSD>>(-1, undefined, getBatchingFn());
    tradeFeed.subscribe((trade) => batchedTradeFeed.publish(trade));
    const paperFeed = new PubSub<Order<BTCUSD>>();
    setPaperOrderFeed(paperFeed);
    const l2OrderBook = new L2OrderBook(BTCUSD_, l2OrderFeed);

    const sTrade = new Signal_Trade(tradeFeed);
    const tsP = new TSignal_P(sTrade);
    const dsOHLC = new DSignal_OHLC(I1SQ_, tsP, 14);
    // dsOHLC.listen((ohlc) => {
    //   console.log('OHLC: ', ohlc);
    // });
    tradeFeed.subscribe((trade) => {
      quotes.setQuote(BTCUSD_, trade.price);
    });

    let runCount = 0;
    const MAX_RUNS = 100;
    let maxTransactionBalance = 0.0;

    const runExperiment = () => {
      const stochasticParams = [
        { kPeriod: 5, dPeriod: 3, slowingPeriod: 3 },
        { kPeriod: 14, dPeriod: 3, slowingPeriod: 3 },
        { kPeriod: 21, dPeriod: 7, slowingPeriod: 7 },
        { kPeriod: 21, dPeriod: 14, slowingPeriod: 14 }
      ];
      const strategyThresholds = [10, 15, 20, 30];
      // const stochasticParams = [
      //   { kPeriod: 5, dPeriod: 2, slowingPeriod: 2 },
      //   { kPeriod: 21, dPeriod: 7, slowingPeriod: 7 },
      //   { kPeriod: 45, dPeriod: 14, slowingPeriod: 14 },
      //   { kPeriod: 120, dPeriod: 30, slowingPeriod: 30 }
      // ];
      // const strategyThresholds = [5, 10, 20, 40];

      console.log('Stochastic params:', stochasticParams);
      console.log('Strategy thresholds:', strategyThresholds);

      // Create all combinations of parameters
      const experiments = stochasticParams.flatMap(sp => 
        strategyThresholds.map(st => ({
          stochasticParams: sp,
          strategyParams: { threshold: st }
        }))
      );
      console.log('Number of experiments:', experiments.length);
      console.log('First experiment:', experiments[0]);
      console.log('Last experiment:', experiments[experiments.length - 1]);

      // Create separate worlds and accounts for each experiment
      const experimentSetups = experiments.map(params => {
        const paperAccount = new Account('paper', 'Paper Account');
        const paperWallet = new Wallet('paper', 'Paper Wallet');
        paperAccount.addWallet(paperWallet);
        paperWallet.depositAsset(new Fund(Asset.USD, 10000000));
        paperWallet.depositAsset(new Fund(Asset.BTC, 100));

        const setup = {
          paperAccount,
          paperFeed: new PubSub<Order<BTCUSD>>(),
          xWorld: null as World_SimpleL2PaperMatching<BTCUSD> | null,
          mrStrat: null as MRStrat_Stochastic<BTCUSD, typeof I1SQ_> | null,
          minorMajorEventFeed: null as ReadOnlyPubSub<boolean> | null,
          params,
          initialValue: paperAccount.computeTotalValue(quotes),
          transactionBalance: 0.0,
          maxTransactionBalance: 0.0
        };

        setup.xWorld = new World_SimpleL2PaperMatching(
          BTCUSD_,
          l2OrderBook,
          setup.paperFeed,
        );

        const dsFullStochastic = new DSignal_FullStochastic(
          I1SQ_,
          dsOHLC,
          params.stochasticParams.kPeriod,
          params.stochasticParams.dPeriod,
          params.stochasticParams.slowingPeriod
        );

        setup.mrStrat = new MRStrat_Stochastic<BTCUSD, typeof I1SQ_>(
          BTCUSD_,
          I1SQ_,
          setup.xWorld,
          paperAccount,
          setup.xWorld.executionFeed,
          dsFullStochastic,
          quotes,
          params.strategyParams.threshold,
          1.0
        );

        setup.minorMajorEventFeed = setup.mrStrat.getMinorMajorEventFeed();

        paperAccount.getTransactionsFeed().subscribe((fundLog) => {
          setup.transactionBalance += quotes.getQuote(fundLog.asset) * fundLog.amount;
          setup.maxTransactionBalance = Math.max(setup.maxTransactionBalance, Math.abs(setup.transactionBalance));
          maxTransactionBalance = Math.max(maxTransactionBalance, Math.abs(setup.transactionBalance));
        });

        return setup;
      });

      // Set the last experiment's world as the main display
      const lastExperiment = experimentSetups[experimentSetups.length - 1];
      setPaperAccount(lastExperiment.paperAccount);
      setPaperOrderFeed(lastExperiment.paperFeed);
      setXWorld(lastExperiment.xWorld);
      setEventFeeds(experimentSetups.map(setup => setup.minorMajorEventFeed).filter((feed): feed is ReadOnlyPubSub<boolean> => feed !== null));

      // Start all experiments
      experimentSetups.forEach(setup => {
        if (setup.mrStrat) {
          setup.mrStrat.start();
        }
      });

      // Add new run results after starting the experiments
      const newRunResults = experimentSetups.map(setup => ({
        baseValue: setup.maxTransactionBalance,
        deltaValue: 0.0,
        isComplete: false,
        startTime: Date.now(),
        stochasticParams: setup.params.stochasticParams,
        strategyParams: setup.params.strategyParams
      }));
      setRunResults(prev => {
        const updated = [...prev, ...newRunResults];
        return updated;
      });
      setGlobalBaseValue(maxTransactionBalance);

      // Update current values every 5 seconds
      const updateInterval = setInterval(() => {
        setRunResults(prev => {
          const newResults = [...prev];
          const startIdx = newResults.length - experiments.length;
          experimentSetups.forEach((setup, i) => {
            if (newResults[startIdx + i].baseValue === 0) {
              newResults[startIdx + i] = {
                ...newResults[startIdx + i],
                baseValue: maxTransactionBalance,
                deltaValue: setup.paperAccount.computeTotalValue(quotes) - setup.initialValue
              };
            } else {
              newResults[startIdx + i] = {
                ...newResults[startIdx + i],
                deltaValue: setup.paperAccount.computeTotalValue(quotes) - setup.initialValue
              };
            }
          });
          return newResults;
        });
      }, 5000);

      setTimeout(() => {
        clearInterval(updateInterval);
        experimentSetups.forEach(setup => {
          if (setup.mrStrat) {
            setup.mrStrat.stop();
          }
        });
        
        console.log('Run completed. Final balances:');
        experimentSetups.forEach((setup, i) => {
          console.log(`Experiment ${i + 1}:`);
          console.log(`  Transaction Balance: ${setup.transactionBalance}`);
          console.log(`  Max Transaction Balance: ${maxTransactionBalance}`);
          console.log(`  Held Value: ${setup.paperAccount.computeHeldValue(quotes)}`);
        });
        
        setRunResults(prev => {
          const newResults = [...prev];
          const startIdx = newResults.length - experiments.length;
          experimentSetups.forEach((setup, i) => {
            newResults[startIdx + i] = {
              ...newResults[startIdx + i],
              deltaValue: setup.paperAccount.computeTotalValue(quotes) - setup.initialValue,
              isComplete: true
            };
          });
          return newResults;
        });

        runCount++;
        
        if (runCount < MAX_RUNS) {
          // Cooldown.
          setTimeout(runExperiment, 3000);
        }
      }, 150000);
    };

    // Wait 3 seconds before starting first experiment
    setTimeout(runExperiment, 3000);

    // const sWorld = new L2PGWorld(
    //   BTCUSD_,
    //   l2OrderBook,
    //   paperFeed,
    //   batchedTradeFeed,
    //   () => ReluctanceFactor.RELUCTANT,
    //   () => 1.0
    // );
    // const fWorld = new L2PGWorld(
    //   BTCUSD_,
    //   l2OrderBook,
    //   paperFeed,
    //   batchedTradeFeed,
    //   () => ReluctanceFactor.AGGRESSIVE_LIMITED,
    //   () => 0.0
    // );
    // setSlowWorld(sWorld);
    // setFastWorld(fWorld);
    setSlowWorld(null);
    setFastWorld(null);

    // sWorld.executionFeed.subscribe((execution) => {
    //   console.log('Execution:', execution);
    // });

    // const mmStrat = new MMStrat_StaticSpread(
    //   BTCUSD_,
    //   sWorld,
    //   paperAccount,
    //   sWorld.executionFeed,
    //   1,
    //   0.1
    // );

    // TODO(P1): Do this properly.
    // setTimeout(() => {
    //   const initialValue = paperAccount?.computeValue(quotes);
    //   console.log('Initial value: ', initialValue);
    //   mmStrat.start();
    //   setInterval(() => {
    //     const currentValue = paperAccount?.computeValue(quotes);
    //     console.log('Paper account delta: ', currentValue - initialValue);
    //   }, 3000);
    // }, 3000);

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
  }, [connect, disconnect]);

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

      {xWorld ? (
        <OrderBookBarChartDisplay orderBook={xWorld.combinedBook} lastRefreshed={lastRefreshed} />
      ) : (
        <div className={styles.loading}>Loading order book...</div>
      )}

      <ExperimentResultsDisplay 
        runResults={runResults} 
        eventPubSubs={eventFeeds}
        globalBaseValue={globalBaseValue}
      />

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

      {xWorld ? (
        <OrderBookTableDisplay orderBook={xWorld.combinedBook} lastRefreshed={lastRefreshed} />
      ) : (
        <div className={styles.loading}>Loading order book...</div>
      )}

      {slowWorld ? (
        <OrderBookBarChartDisplay orderBook={slowWorld.combinedBook} lastRefreshed={lastRefreshed} />
      ) : (
        <div className={styles.loading}>Loading order book...</div>
      )}

      {fastWorld ? (
        <OrderBookBarChartDisplay orderBook={fastWorld.combinedBook} lastRefreshed={lastRefreshed} />
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
