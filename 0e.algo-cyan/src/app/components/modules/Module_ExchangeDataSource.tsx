'use client';

import React, { useState, useEffect } from 'react';
import { useCoinbaseWebSocket } from '../../hooks/useCoinbaseWebSocket';
import { CoinbaseDataAdapter } from '../../adapters/CoinbaseDataAdapter';
import { BTCUSD_ } from '@/lib/derived/AssetPairs';
import BaseModule, { BaseModuleProps } from './BaseModule';
import styles from './Module_ExchangeDataSource.module.css';

interface ModuleExchangeDataSourceProps extends BaseModuleProps {}

const Module_ExchangeDataSource: React.FC<ModuleExchangeDataSourceProps> = ({ onClose, gridSize, title }) => {
  const { connect, disconnect } = useCoinbaseWebSocket();
  const [isConnected, setIsConnected] = useState(false);
  const [coinbaseAdapter, setCoinbaseAdapter] = useState<CoinbaseDataAdapter<typeof BTCUSD_> | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');

  useEffect(() => {
    const adapter = new CoinbaseDataAdapter(BTCUSD_);
    setCoinbaseAdapter(adapter);
  }, []);

  const handleConnect = () => {
    if (!coinbaseAdapter) return;

    connect({
      onMessage: (data) => {
        coinbaseAdapter.onMessage(data);
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('Error');
        setIsConnected(false);
      },
      onOpen: () => {
        console.log('Connected to Coinbase.');
        setConnectionStatus('Connected');
        setIsConnected(true);
      },
    });
  };

  const handleDisconnect = () => {
    disconnect();
    setConnectionStatus('Disconnected');
    setIsConnected(false);
  };

  return (
    <BaseModule onClose={onClose} title={title} gridSize={gridSize}>
      <div className={styles.content} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className={styles.statusSection} style={{ flex: '0 0 auto' }}>
          <div className={styles.statusIndicator}>
            <span className={`${styles.statusDot} ${isConnected ? styles.connected : styles.disconnected}`}></span>
            <span className={styles.statusText}>{connectionStatus}</span>
          </div>
        </div>
        <div className={styles.controls} style={{ flex: '0 0 auto' }}>
          {!isConnected ? (
            <button 
              className={styles.connectButton} 
              onClick={handleConnect}
              disabled={!coinbaseAdapter}
            >
              Connect to Coinbase
            </button>
          ) : (
            <button 
              className={styles.disconnectButton} 
              onClick={handleDisconnect}
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </BaseModule>
  );
};

export default Module_ExchangeDataSource; 