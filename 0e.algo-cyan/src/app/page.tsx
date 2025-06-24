'use client';

import React, { useEffect } from 'react';
import styles from './page.module.css';
import OrderBookTableDisplay from './components/OrderBookTableDisplay';
import OrderBookBarChartDisplay from './components/OrderBookBarChartDisplay';
import ExperimentResultsDisplayV2 from './components/ExperimentResultsDisplayV2';
import { CoinbaseWebSocketProvider } from './providers/CoinbaseWebSocketProvider';
import { useCoinbaseWebSocket } from './hooks/useCoinbaseWebSocket';
import { PubSub, ReadOnlyPubSub } from '@/lib/infra/PubSub';
import { Order, OrderStatus } from '@/lib/base/Order';
import { CoinbaseDataAdapter } from './adapters/CoinbaseDataAdapter';
import OrderForm from './components/OrderForm';
import { Side } from '@/lib/base/Order';
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
import { PaperExchange } from '@/lib/derived/PaperExchange';
import { MRStrat_Stochastic } from '@/lib/derived/MRStrat_Stochastic';
import { RunResultV2 } from '@/lib/base/RunResultV2';
import { DSignalTAdapter_Clock } from '@/lib/infra/signals/DSignal';
import ChipSelector from './components/ChipSelector';
import { FileDataAdapter } from './adapters/FileDataAdapter';
import FileOrderingDisplay from './components/FileOrderingDisplay';
import { IntelligenceV1, IntelligenceV1Type } from '@/lib/base/Intelligence';
import { RunV2 } from '@/lib/base/RunV2';
import { WorldMaker_PXFA } from '@/lib/derived/World_PXFA';
import { AgentMaker_Stochastic } from '@/lib/derived/Agent_Stochastic';
import { FirmMaker_Default } from '@/lib/derived/Firm_Default';
import { Experiment } from '@/lib/base/Experiment';
import { Trade } from '@/lib/base/Trade';
import { FixedQuantityParam, StochasticThresholdParam, VariationUtils } from '@/lib/base/Variations';
import { StochasticWindowParams } from '@/lib/base/Variations';
// TODO(P3): Standardize all these import styles.

const Dashboard = () => {
  const { connect, disconnect } = useCoinbaseWebSocket();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [quotes] = React.useState(new Quotes(Asset.USD));

  const [displayExchange, setDisplayExchange] = React.useState<PaperExchange<BTCUSD> | null>(null);
  const [lastRefreshed, setLastRefreshed] = React.useState(Date.now());
  const [assetPair] = React.useState(new BTCUSD());
  const [runResults, setRunResults] = React.useState<RunResultV2[]>([]);
  const [eventFeeds, setEventFeeds] = React.useState<ReadOnlyPubSub<IntelligenceV1>[]>([]);
  const [selectedChip, setSelectedChip] = React.useState('OFF');
  const [fileAdapter, setFileAdapter] = React.useState<FileDataAdapter<BTCUSD> | null>(null);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [areExperimentsRunning, setAreExperimentsRunning] = React.useState(false);

  const setupExperiment = (
    l2OrderFeed: PubSub<Order<BTCUSD>>,
    tradeFeed: PubSub<Trade<BTCUSD>>
  ) => {

    const sTrade = new Signal_Trade(tradeFeed);
    const tsP = new TSignal_P(sTrade);
    const dsClock = new DSignalTAdapter_Clock(I1SQ_, tsP);
    const dsOHLC = new DSignal_OHLC(I1SQ_, tsP, 14);
    tradeFeed.subscribe((trade) => {
      quotes.setQuote(BTCUSD_, trade.price);
      setLastRefreshed(Date.now());
    });

    const agentMaker = new AgentMaker_Stochastic(BTCUSD_, I1SQ_);
    const firmMaker = new FirmMaker_Default([agentMaker]);
    const worldMaker = new WorldMaker_PXFA(BTCUSD_, I1SQ_, l2OrderFeed, tradeFeed, dsClock, dsOHLC, quotes, firmMaker);

    const config = {
      MAX_RUNS: 100,
      INITIAL_DELAY_MS: 1000 * 60, // 1 full minute for 1-second interval signals to warm up.
      RUN_DURATION_MS: 1000 * 60 * 60, // 1-hour runs.
      COOLDOWN_MS: 1000 * 10, // Pause for 10 seconds between runs.
      RENDER_RESULTS_EVERY_MS: 5 * 60 * 1000, // Calculate results every 5 minutes (clock time).
    }

    const variations = 
    VariationUtils.addFixedParam(
      VariationUtils.cross(
        VariationUtils.getDefaultVariations(StochasticWindowParams),
        VariationUtils.getDefaultVariations(StochasticThresholdParam)
      ),
      VariationUtils.getDefaultValue(FixedQuantityParam)
    )

    const experiment = new Experiment(dsClock, worldMaker, variations, config);


    const runExperiment = () => {
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

        const run = new RunV2<BTCUSD>(paperAccount, params, quotes);

        run.xWorld = new PaperExchange(
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
              run.netCapitalExposure -= quotes.getQuote(fundLog.asset) * fundLog.amount;
            }
            run.maxNetCapitalExposure = Math.max(run.maxNetCapitalExposure, Math.abs(run.netCapitalExposure));
            maxNetCapitalExposure = Math.max(maxNetCapitalExposure, Math.abs(run.netCapitalExposure));
          }
        });

        run.xWorld.executionFeed.subscribe((execution) => {
          if (execution.buyOrder.account === run.paperAccount && (execution.buyOrder.status === OrderStatus.FILLED || execution.buyOrder.status === OrderStatus.CANCELLED)) {
            run.orderSummaries.push(`BUY ${execution.buyOrder.filled_qty.toFixed(2)} BTC @ ${execution.buyOrder.price.toFixed(2)} USD`);
          } else if (execution.sellOrder.account === run.paperAccount && (execution.sellOrder.status === OrderStatus.FILLED || execution.sellOrder.status === OrderStatus.CANCELLED)) {
            run.orderSummaries.push(`SELL ${execution.sellOrder.filled_qty.toFixed(2)} BTC @ ${execution.sellOrder.price.toFixed(2)} USD`);
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
      setDisplayExchange(lastExperiment.xWorld);
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
        orderSummaries: run.orderSummaries,
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

          {displayExchange ? (
            <OrderBookBarChartDisplay orderBook={displayExchange.combinedOrderBook} lastRefreshed={lastRefreshed} />
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

          {displayExchange ? (
            <OrderBookTableDisplay orderBook={displayExchange.combinedOrderBook} lastRefreshed={lastRefreshed} />
          ) : (
            <div className={styles.loading}>Loading order book...</div>
          )}

          {slowWorld ? (
            <OrderBookBarChartDisplay orderBook={slowWorld.combinedOrderBook} lastRefreshed={lastRefreshed} />
          ) : (
            <div className={styles.loading}>Loading order book...</div>
          )}

          {fastWorld ? (
            <OrderBookBarChartDisplay orderBook={fastWorld.combinedOrderBook} lastRefreshed={lastRefreshed} />
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
