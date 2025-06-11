'use client';

import React, { useEffect } from 'react';
import styles from './page.module.css';
import OrderBookTableDisplay from './components/OrderBookTableDisplay';
import OrderBookBarChartDisplay from './components/OrderBookBarChartDisplay';
import ExperimentResultsDisplayV2 from './components/ExperimentResultsDisplayV2';
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
import { RunResultV2 } from '@/lib/base/RunResultV2';
import { DSignalTAdapter_Clock } from '@/lib/infra/signals/DSignal';
import ChipSelector from './components/ChipSelector';
import { FileDataAdapter } from './adapters/FileDataAdapter';
// TODO(P3): Standardize all these import styles.

const Dashboard = () => {
  const { connect, disconnect } = useCoinbaseWebSocket();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [slowWorld, setSlowWorld] = React.useState<L2PGWorld<BTCUSD> | null>(null);
  const [fastWorld, setFastWorld] = React.useState<L2PGWorld<BTCUSD> | null>(null);
  const [xWorld, setXWorld] = React.useState<World_SimpleL2PaperMatching<BTCUSD> | null>(null);
  const [lastRefreshed, setLastRefreshed] = React.useState(Date.now());
  const [paperOrderFeed, setPaperOrderFeed] = React.useState<PubSub<Order<BTCUSD>> | null>(null);
  const [paperAccount, setPaperAccount] = React.useState<Account | null>(null);
  const [assetPair] = React.useState(new BTCUSD());
  const [runResults, setRunResults] = React.useState<RunResultV2[]>([]);
  const [eventFeeds, setEventFeeds] = React.useState<ReadOnlyPubSub<boolean>[]>([]);
  const [quotes] = React.useState(new Quotes(Asset.USD));
  const [globalMaxNetCapitalExposure, setGlobalMaxNetCapitalExposure] = React.useState<number>(0);
  const [selectedChip, setSelectedChip] = React.useState('OFF');
  const [fileAdapter, setFileAdapter] = React.useState<FileDataAdapter<BTCUSD> | null>(null);

  const setupExperiment = (
    l2OrderFeed: PubSub<Order<BTCUSD>>,
    tradeFeed: PubSub<Trade<BTCUSD>>
  ) => {
    const batchedTradeFeed = new BatchedPubSub<Trade<BTCUSD>>(-1, undefined, getBatchingFn());
    tradeFeed.subscribe((trade) => batchedTradeFeed.publish(trade));
    const paperFeed = new PubSub<Order<BTCUSD>>();
    setPaperOrderFeed(paperFeed);
    const l2OrderBook = new L2OrderBook(BTCUSD_, l2OrderFeed);

    const sTrade = new Signal_Trade(tradeFeed);
    const tsP = new TSignal_P(sTrade);
    const dsClock = new DSignalTAdapter_Clock(I1SQ_, tsP);
    const dsOHLC = new DSignal_OHLC(I1SQ_, tsP, 14);
    // dsOHLC.listen((ohlc) => {
    //   console.log('OHLC: ', ohlc);
    // });
    tradeFeed.subscribe((trade) => {
      quotes.setQuote(BTCUSD_, trade.price);
      setLastRefreshed(Date.now());
    });

    let runCount = 0;
    const MAX_RUNS = 100;
    let maxNetCapitalExposure = 0.0;
    let nextUpdateAt: number | null = null;
    let endExperimentAt: number | null = null;
    let startExperimentAt: number | null = null;
    let experimentRunning = false;
    const EXPERIMENT_DURATION_MS = 15 * 60 * 1000;
    const COOLDOWN_DURATION_MS = 3000;
    const UPDATE_INTERVAL_MS = 60 * 1000;
    const INITIAL_DELAY_MS = 1000;
    let experiments: { stochasticParams: { kPeriod: number; dPeriod: number; slowingPeriod: number }; strategyParams: { threshold: number } }[] = [];
    let experimentSetups: { paperAccount: Account; paperFeed: PubSub<Order<BTCUSD>>; xWorld: World_SimpleL2PaperMatching<BTCUSD> | null; mrStrat: MRStrat_Stochastic<BTCUSD, typeof I1SQ_> | null; minorMajorEventFeed: ReadOnlyPubSub<boolean> | null; params: { stochasticParams: { kPeriod: number; dPeriod: number; slowingPeriod: number }; strategyParams: { threshold: number } }; initialValue: number; netCapitalExposure: number; maxNetCapitalExposure: number }[] = [];
    let snapshotQuotes = quotes.copy();

    dsClock.listen((clock) => {
      if (startExperimentAt === null) {
        startExperimentAt = clock.timestamp + INITIAL_DELAY_MS;
      }

      if (experimentRunning && nextUpdateAt !== null && clock.timestamp >= nextUpdateAt) {
        nextUpdateAt = null;
        setRunResults(prev => {
          const newResults = [...prev];
          const startIdx = newResults.length - experiments.length;
          experimentSetups.forEach((setup, i) => {
            if (newResults[startIdx + i].maxNetCapitalExposure === 0) {
              newResults[startIdx + i] = {
                ...newResults[startIdx + i],
                maxNetCapitalExposure: maxNetCapitalExposure,
                deltaAccountValue: setup.paperAccount.computeTotalValue(quotes) - setup.initialValue,
                finalQuote: quotes.getQuote(Asset.BTC)
              };
            } else {
              newResults[startIdx + i] = {
                ...newResults[startIdx + i],
                deltaAccountValue: setup.paperAccount.computeTotalValue(quotes) - setup.initialValue,
                finalQuote: quotes.getQuote(Asset.BTC)
              };
            }
          });
          return newResults;
        });
        nextUpdateAt = clock.timestamp + UPDATE_INTERVAL_MS;
      }

      if (experimentRunning && endExperimentAt !== null && clock.timestamp >= endExperimentAt) {

        experimentRunning = false;
        endExperimentAt = null;
        nextUpdateAt = null;

        experimentSetups.forEach(setup => {
          if (setup.mrStrat) {
            setup.mrStrat.stop();
          }
        });
        
        console.log('Run completed. Final balances:');
        experimentSetups.forEach((setup, i) => {
          console.log(`Experiment ${i + 1}:`);
          console.log(`  Transaction Balance: ${setup.netCapitalExposure}`);
          console.log(`  Max Transaction Balance: ${maxNetCapitalExposure}`);
          console.log(`  Held Value: ${setup.paperAccount.computeHeldValue(quotes)}`);
        });
        setRunResults(prev => {
          const newResults = [...prev];
          const startIdx = newResults.length - experiments.length;
          experimentSetups.forEach((setup, i) => {
            newResults[startIdx + i] = {
              ...newResults[startIdx + i],
              deltaAccountValue: setup.paperAccount.computeTotalValue(quotes) - setup.initialValue,
              finalQuote: quotes.getQuote(Asset.BTC),
              isComplete: true
            };
          });
          return newResults;
        });

        runCount++;
        if (runCount < MAX_RUNS) {
          startExperimentAt = clock.timestamp + COOLDOWN_DURATION_MS;
        }
      }

      if (!experimentRunning && startExperimentAt !== null && clock.timestamp >= startExperimentAt) {
        experimentRunning = true;
        startExperimentAt = null;
        endExperimentAt = clock.timestamp + EXPERIMENT_DURATION_MS;
        nextUpdateAt = clock.timestamp + UPDATE_INTERVAL_MS;
        snapshotQuotes = quotes.copy();
        runExperiment();
      }
    });

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

      // Create all combinations of parameters
      experiments = stochasticParams.flatMap(sp => 
        strategyThresholds.map(st => ({
          stochasticParams: sp,
          strategyParams: { threshold: st }
        }))
      );

      // Create separate worlds and accounts for each experiment
      experimentSetups = experiments.map(params => {
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
          netCapitalExposure: 0.0,
          maxNetCapitalExposure: 0.0
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
          // Only count deposits toward orders.
          if (fundLog.amount > 0) {
            if (fundLog.asset === Asset.USD) {
              setup.netCapitalExposure += fundLog.amount;
              // console.log('Deposit USD! Increase net exposure by: ', fundLog.amount);
            } else {
              setup.netCapitalExposure -= snapshotQuotes.getQuote(fundLog.asset) * fundLog.amount;
              // console.log('Deposit BTC! Decrease net exposure by: ', snapshotQuotes.getQuote(fundLog.asset) * fundLog.amount);
            }
            setup.maxNetCapitalExposure = Math.max(setup.maxNetCapitalExposure, Math.abs(setup.netCapitalExposure));
            maxNetCapitalExposure = Math.max(maxNetCapitalExposure, Math.abs(setup.netCapitalExposure));
          }
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
        originalQuote: quotes.getQuote(Asset.BTC),
        finalQuote: quotes.getQuote(Asset.BTC),
        maxNetCapitalExposure: setup.maxNetCapitalExposure,
        deltaAccountValue: 0.0,
        isComplete: false,
        startTime: Date.now(),
        stochasticParams: setup.params.stochasticParams,
        strategyParams: setup.params.strategyParams
      }));
      setRunResults(prev => {
        const updated = [...prev, ...newRunResults];
        return updated;
      });
      setGlobalMaxNetCapitalExposure(maxNetCapitalExposure);
    };

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
  };

  useEffect(() => {
    if (selectedChip === 'OFF') {
      disconnect();
      setFileAdapter(null);
      return;
    }

    if (selectedChip === 'REAL-TIME') {
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

      const coinbaseAdapter = new CoinbaseDataAdapter(BTCUSD_);
      setupExperiment(
        coinbaseAdapter.getL2OrderFeed(),
        coinbaseAdapter.getTradeFeed()
      );
    } else if (selectedChip === 'FILE') {
      // Create adapter when switching to FILE mode
      const adapter = new FileDataAdapter(BTCUSD_);
      setFileAdapter(adapter);
      setupExperiment(
        adapter.getL2OrderFeed(),
        adapter.getTradeFeed()
      );
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  }, [selectedChip, connect, disconnect]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    console.log('Selected file:', file.name, 'size:', file.size);
    
    try {
      if (!fileAdapter) {
        throw new Error('File adapter not initialized');
      }
      await fileAdapter.loadFile(file);
      console.log('File loaded successfully');
    } catch (error) {
      console.error('Error loading file:', error);
    }
  };

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
      <ChipSelector selected={selectedChip} onSelect={setSelectedChip} />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        accept=".json"
      />
      <h1 className={styles.title}>BTC-USD Order Book</h1>
      <div className={styles.controls}>
        <button className={styles.powerButton} onClick={handlePowerOff}>
          Power Off
        </button>
        <div className={styles.status}>
          {selectedChip === 'REAL-TIME' ? 'Connecting...' : 
           selectedChip === 'FILE' ? 'Select a file...' : 'Off'}
        </div>
      </div>

      {(selectedChip === 'REAL-TIME' || selectedChip === 'FILE') && (
        <>
          {xWorld ? (
            <OrderBookBarChartDisplay orderBook={xWorld.combinedBook} lastRefreshed={lastRefreshed} />
          ) : (
            <div className={styles.loading}>Loading order book...</div>
          )}

          <ExperimentResultsDisplayV2 
            runResults={runResults} 
            eventPubSubs={eventFeeds}
            globalMaxNetCapitalExposure={globalMaxNetCapitalExposure}
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
        </>
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
