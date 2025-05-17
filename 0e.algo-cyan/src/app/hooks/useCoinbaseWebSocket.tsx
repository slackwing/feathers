'use client';

import { useContext } from 'react';
import { CoinbaseWebSocketContext } from '../providers/CoinbaseWebSocketProvider';

export const useCoinbaseWebSocket = () => {
  const context = useContext(CoinbaseWebSocketContext);
  if (!context) {
    throw new Error('useCoinbaseWebSocket must be used within a CoinbaseWebSocketProvider');
  }
  return context;
};
