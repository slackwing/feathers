'use client';

import React from 'react';
import BaseModule, { BaseModuleProps } from './BaseModule';
import OrderBookTableDisplay from '../OrderBookTableDisplay';
import { OrderBook } from '@/lib/base/OrderBook';
import { BTCUSD_ } from '@/lib/derived/AssetPairs';
import styles from './Module_OrderBook.module.css';

interface ModuleOrderBookProps extends BaseModuleProps {}

const Module_OrderBook: React.FC<ModuleOrderBookProps> = ({ onClose, gridSize, title }) => {
  // For now, we'll create an empty order book structure
  // This will be connected to data sources later
  const emptyOrderBook = new OrderBook(BTCUSD_);

  return (
    <BaseModule onClose={onClose} title={title} gridSize={gridSize}>
      <div className={styles.content} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className={styles.tableContainer} style={{ flex: '1 1 auto', width: '100%' }}>
          <OrderBookTableDisplay 
            orderBook={emptyOrderBook} 
            lastRefreshed={Date.now()} 
          />
        </div>
      </div>
    </BaseModule>
  );
};

export default Module_OrderBook; 