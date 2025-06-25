'use client';

import React from 'react';
import BaseModule, { BaseModuleProps } from './BaseModule';
import OrderBookBarChartDisplay from '../OrderBookBarChartDisplay';
import { OrderBook } from '@/lib/base/OrderBook';
import { BTCUSD_ } from '@/lib/derived/AssetPairs';
import styles from './Module_MarketDepthHistogram.module.css';

interface ModuleMarketDepthHistogramProps extends BaseModuleProps {}

const Module_MarketDepthHistogram: React.FC<ModuleMarketDepthHistogramProps> = ({ onClose }) => {
  // For now, we'll create an empty order book structure
  // This will be connected to data sources later
  const emptyOrderBook = new OrderBook(BTCUSD_);

  return (
    <BaseModule onClose={onClose} title="Market Depth Histogram">
      <div className={styles.content}>
        <div className={styles.chartContainer}>
          <OrderBookBarChartDisplay 
            orderBook={emptyOrderBook} 
            lastRefreshed={Date.now()} 
          />
        </div>
        
        <div className={styles.info}>
          <p>This module displays market depth as a histogram visualization.</p>
          <p>Connect to a data source to see live market depth data.</p>
        </div>
      </div>
    </BaseModule>
  );
};

export default Module_MarketDepthHistogram; 