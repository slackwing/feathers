'use client';

import React from 'react';
import BaseModule, { BaseModuleProps } from './BaseModule';
import OrderBookBarChartDisplay from '../OrderBookBarChartDisplay';
import { OrderBook } from '@/lib/base/OrderBook';
import { BTCUSD_ } from '@/lib/derived/AssetPairs';
import styles from './Module_MarketDepthHistogram.module.css';

interface ModuleMarketDepthHistogramProps extends BaseModuleProps {}

const Module_MarketDepthHistogram: React.FC<ModuleMarketDepthHistogramProps> = ({ onClose, gridSize, title }) => {
  // For now, we'll create an empty order book structure
  // This will be connected to data sources later
  const emptyOrderBook = new OrderBook(BTCUSD_);

  return (
    <BaseModule onClose={onClose} title={title} gridSize={gridSize}>
      <div className={styles.content} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className={styles.chartContainer} style={{ flex: '1 1 auto', width: '100%' }}>
          <OrderBookBarChartDisplay 
            orderBook={emptyOrderBook} 
            lastRefreshed={Date.now()} 
          />
        </div>
      </div>
    </BaseModule>
  );
};

export default Module_MarketDepthHistogram; 