'use client';

import React from 'react';
import BaseModule, { BaseModuleProps } from './BaseModule';
import OrderBookTableDisplay from '../OrderBookTableDisplay';
import { OrderBook } from '@/lib/base/OrderBook';
import { BTCUSD_ } from '@/lib/derived/AssetPairs';
import styles from './Module_OrderBook.module.css';

interface ModuleOrderBookProps extends BaseModuleProps {}

const Module_OrderBook: React.FC<ModuleOrderBookProps> = ({ onClose }) => {
  // For now, we'll create an empty order book structure
  // This will be connected to data sources later
  const emptyOrderBook = new OrderBook(BTCUSD_);

  return (
    <BaseModule onClose={onClose} title="Order Book">
      <div className={styles.content}>
        <div className={styles.tableContainer}>
          <OrderBookTableDisplay 
            orderBook={emptyOrderBook} 
            lastRefreshed={Date.now()} 
          />
        </div>
        
        <div className={styles.info}>
          <p>This module displays the order book as a table.</p>
          <p>Connect to a data source to see live order book data.</p>
        </div>
      </div>
    </BaseModule>
  );
};

export default Module_OrderBook; 