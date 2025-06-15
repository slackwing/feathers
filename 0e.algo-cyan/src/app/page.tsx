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
import FileOrderingDisplay from './components/FileOrderingDisplay';
import { IntelligenceV1, IntelligenceV1Type } from '@/lib/base/Intelligence';
import { Run } from '@/lib/base/Run';
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
  const [eventFeeds, setEventFeeds] = React.useState<ReadOnlyPubSub<IntelligenceV1>[]>([]);
  const [quotes] = React.useState(new Quotes(Asset.USD));
  const [selectedChip, setSelectedChip] = React.useState('OFF');
  const [fileAdapter, setFileAdapter] = React.useState<FileDataAdapter<BTCUSD> | null>(null);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [areExperimentsRunning, setAreExperimentsRunning] = React.useState(false);

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
    const EXPERIMENT_DURATION_MS = 60 * 60 * 1000;
    const COOLDOWN_DURATION_MS = 10 * 1000;
    const UPDATE_INTERVAL_MS = 5 * 60 * 1000;
    const INITIAL_DELAY_MS = 1000;
    let parameterSet: { stochasticParams: { kPeriod: number; dPeriod: number; slowingPeriod: number }; strategyParams: { threshold: number } }[] = [];
    let runs: Run<BTCUSD>[] = [];
    let snapshotQuotes = quotes.copy();

    dsClock.listen((clock) => {
      if (startExperimentAt === null) {
        startExperimentAt = clock.timestamp + INITIAL_DELAY_MS;
      }

      if (experimentRunning && nextUpdateAt !== null && clock.timestamp >= nextUpdateAt) {
        nextUpdateAt = null;
        setRunResults(prev => {
          const newResults = [...prev];
          const startIdx = newResults.length - parameterSet.length;
          runs.forEach((setup, i) => {
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

        runs.forEach(setup => {
          if (setup.mrStrat) {
            setup.mrStrat.stop();
          }
        });
        
        console.log('Run completed. Final balances:');
        runs.forEach((setup, i) => {
          console.log(`Experiment ${i + 1}:`);
          console.log(`  Transaction Balance: ${setup.netCapitalExposure}`);
          console.log(`  Max Transaction Balance: ${maxNetCapitalExposure}`);
          console.log(`  Held Value: ${setup.paperAccount.computeHeldValue(quotes)}`);
        });
        setRunResults(prev => {
          const newResults = [...prev];
          const startIdx = newResults.length - parameterSet.length;
          runs.forEach((setup, i) => {
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
        { kPeriod: 14, dPeriod: 3, slowingPeriod: 3 }, // 1-second (14, 3, 3)
        { kPeriod: 14*5, dPeriod: 3*5, slowingPeriod: 3*5 }, // 5-second (14, 3, 3)
        { kPeriod: 14*10, dPeriod: 3*10, slowingPeriod: 3*10 }, // 10-second (14, 3, 3)
        { kPeriod: 14*15, dPeriod: 3*15, slowingPeriod: 3*15 }, // 15-second (14, 3, 3)
      ];
      const strategyThresholds = [30, 20, 15, 10];
      // const stochasticParams = [
      //   { kPeriod: 5, dPeriod: 3, slowingPeriod: 3 },
      //   { kPeriod: 14, dPeriod: 3, slowingPeriod: 3 },
      //   { kPeriod: 21, dPeriod: 7, slowingPeriod: 7 },
      //   { kPeriod: 21, dPeriod: 14, slowingPeriod: 14 }
      // ];
      // const strategyThresholds = [10, 15, 20, 30];
      // const stochasticParams = [
      //   { kPeriod: 5, dPeriod: 2, slowingPeriod: 2 },
      //   { kPeriod: 21, dPeriod: 7, slowingPeriod: 7 },
      //   { kPeriod: 45, dPeriod: 14, slowingPeriod: 14 },
      //   { kPeriod: 120, dPeriod: 30, slowingPeriod: 30 }
      // ];
      // const strategyThresholds = [5, 10, 20, 40];

      // Create all combinations of parameters
      parameterSet = stochasticParams.flatMap(sp => 
        strategyThresholds.map(st => ({
          stochasticParams: sp,
          strategyParams: { threshold: st }
        }))
      );

      // Create separate worlds and accounts for each experiment
      runs = parameterSet.map(params => {
        const paperAccount = new Account('paper', 'Paper Account');
        const paperWallet = new Wallet('paper', 'Paper Wallet');
        paperAccount.addWallet(paperWallet);
        paperWallet.depositAsset(new Fund(Asset.USD, 10000000));
        paperWallet.depositAsset(new Fund(Asset.BTC, 100));

        const run = new Run<BTCUSD>(paperAccount, params, quotes);

        run.xWorld = new World_SimpleL2PaperMatching(
          BTCUSD_,
          l2OrderBook,
          run.paperFeed,
        );

        const dsFullStochastic = new DSignal_FullStochastic(
          I1SQ_,
          dsOHLC,
          params.stochasticParams.kPeriod,
          params.stochasticParams.dPeriod,
          params.stochasticParams.slowingPeriod
        );

        run.mrStrat = new MRStrat_Stochastic<BTCUSD, typeof I1SQ_>(
          BTCUSD_,
          I1SQ_,
          run.xWorld,
          paperAccount,
          run.xWorld.executionFeed,
          dsFullStochastic,
          quotes,
          params.strategyParams.threshold,
          1.0
        );

        run.intelligenceFeed = run.mrStrat.getIntelligenceFeed();

        paperAccount.getTransactionsFeed().subscribe((fundLog) => {
          // Only count deposits toward orders.
          if (fundLog.amount > 0) {
            if (fundLog.asset === Asset.USD) {
              run.netCapitalExposure += fundLog.amount;
            } else {
              run.netCapitalExposure -= snapshotQuotes.getQuote(fundLog.asset) * fundLog.amount;
            }
            run.maxNetCapitalExposure = Math.max(run.maxNetCapitalExposure, Math.abs(run.netCapitalExposure));
            maxNetCapitalExposure = Math.max(maxNetCapitalExposure, Math.abs(run.netCapitalExposure));
          }
        });

        run.intelligenceFeed.subscribe((intel) => {
          run.intelCounts.set(intel.type, (run.intelCounts.get(intel.type) || 0) + 1);
          if (intel.type === IntelligenceV1Type.SIGNAL) {
            const now = Date.now();
            if (run.lastSignalTime !== 0) {
              run.timeBetweenSignals.push(now - run.lastSignalTime);
            }
            run.lastSignalTime = now;
          }
        });

        return run;
      });

      // Set the last experiment's world as the main display
      const lastExperiment = runs[runs.length - 1];
      setPaperAccount(lastExperiment.paperAccount);
      setPaperOrderFeed(lastExperiment.paperFeed);
      setXWorld(lastExperiment.xWorld);
      setEventFeeds(runs.map(setup => setup.intelligenceFeed).filter((feed): feed is ReadOnlyPubSub<IntelligenceV1> => feed !== null));

      // Start all experiments
      runs.forEach(setup => {
        if (setup.mrStrat) {
          setup.mrStrat.start();
        }
      });

      // Add new run results after starting the experiments
      const newRunResults = runs.map(run => ({
        durationMs: EXPERIMENT_DURATION_MS,
        originalQuote: quotes.getQuote(Asset.BTC),
        finalQuote: quotes.getQuote(Asset.BTC),
        maxNetCapitalExposure: run.maxNetCapitalExposure,
        deltaAccountValue: 0.0,
        isComplete: false,
        startTime: Date.now(),
        stochasticParams: run.params.stochasticParams,
        strategyParams: run.params.strategyParams,
        timeBetweenSignals: run.timeBetweenSignals,
        intelCounts: run.intelCounts,
        getSignalCount: () => run.getSignalCount(),
        getAverageTimeBetweenSignals: () => run.getAverageTimeBetweenSignals(),
        getStdDeviationTimeBetweenSignals: () => run.getStdDeviationTimeBetweenSignals(),
        getOversignalCount: () => run.getOversignalCount(),
        getPresignalCount: () => run.getPresignalCount(),
        getOversignalRatio: () => run.getOversignalRatio()
      }));
      setRunResults(prev => {
        const updated = [...prev, ...newRunResults];
        return updated;
      });
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
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      console.log('No files selected');
      return;
    }
    
    if (files.length === 1) {
      // Single file - run experiment immediately
      try {
        if (!fileAdapter) {
          throw new Error('File adapter not initialized');
        }
        await fileAdapter.loadFile(files);
        console.log('File loaded successfully');
        setAreExperimentsRunning(true);
      } catch (error) {
        console.error('Error loading file:', error);
      }
    } else {
      // Multiple files - show file selection UI
      setSelectedFiles(files);
    }
  };

  const handleRunExperiment = async () => {
    if (!fileAdapter || selectedFiles.length === 0) return;
    
    try {
      await fileAdapter.loadFile(selectedFiles);
      console.log('File loaded successfully');
      setAreExperimentsRunning(true);
    } catch (error) {
      console.error('Error loading file:', error);
    }
  };

  const handleFileReorder = (newOrder: File[]) => {
    setSelectedFiles(newOrder);
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
        accept=".ndjson"
        multiple
      />
      <h1 className={styles.title}>BTC-USD Order Book</h1>
      <div className={styles.controls}>
        <button className={styles.powerButton} onClick={handlePowerOff}>
          Power Off
        </button>
        <div className={styles.status}>
          {selectedChip === 'REAL-TIME' ? 'Connecting...' : 
           selectedChip === 'FILE' ? (selectedFiles.length > 0 ? `${selectedFiles.length} files selected` : 'Select files...') : 'Off'}
        </div>
      </div>

      {(selectedChip === 'REAL-TIME' || selectedChip === 'FILE') && (
        <>
          {selectedChip === 'FILE' && selectedFiles.length > 1 && !areExperimentsRunning && (
            <FileOrderingDisplay
              files={selectedFiles}
              onReorder={handleFileReorder}
              onRun={handleRunExperiment}
            />
          )}

          {xWorld ? (
            <OrderBookBarChartDisplay orderBook={xWorld.combinedBook} lastRefreshed={lastRefreshed} />
          ) : (
            <div className={styles.loading}>Loading order book...</div>
          )}

          <ExperimentResultsDisplayV2 
            runResults={runResults} 
            eventPubSubs={eventFeeds}
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
