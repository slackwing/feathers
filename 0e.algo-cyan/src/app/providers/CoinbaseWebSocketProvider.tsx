'use client';

import * as React from 'react';
import { createContext, useEffect, useRef, useCallback } from 'react';
import { CoinbaseWebSocketService } from '../types/coinbase';

const WS_API_URL = 'wss://advanced-trade-ws.coinbase.com';

export const CoinbaseWebSocketContext = createContext<CoinbaseWebSocketService | null>(null);

export const CoinbaseWebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(
    (callbacks: {
      onMessage?: (data: any) => void;
      onError?: (error: Event) => void;
      onOpen?: () => void;
    }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      const ws = new WebSocket(WS_API_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to Coinbase WebSocket.');
        callbacks.onOpen?.();

        const heartbeatMessage = {
          type: 'subscribe',
          channel: 'heartbeats',
        };
        ws.send(JSON.stringify(heartbeatMessage));

        const level2Message = {
          type: 'subscribe',
          channel: 'level2',
          product_ids: ['BTC-USD'],
        };
        ws.send(JSON.stringify(level2Message));

        const marketTradesMessage = {
          type: 'subscribe',
          channel: 'market_trades',
          product_ids: ['BTC-USD'],
        };
        ws.send(JSON.stringify(marketTradesMessage));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        callbacks.onMessage?.(data);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        callbacks.onError?.(error);
      };
    },
    []
  );

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      const unsubscribeMessage = {
        type: 'unsubscribe',
        channel: 'level2',
        product_ids: ['BTC-USD'],
      };
      wsRef.current.send(JSON.stringify(unsubscribeMessage));

      const unsubscribeMarketTrades = {
        type: 'unsubscribe',
        channel: 'market_trades',
        product_ids: ['BTC-USD'],
      };
      wsRef.current.send(JSON.stringify(unsubscribeMarketTrades));

      const unsubscribeHeartbeat = {
        type: 'unsubscribe',
        channel: 'heartbeats',
      };
      wsRef.current.send(JSON.stringify(unsubscribeHeartbeat));

      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return (
    <CoinbaseWebSocketContext.Provider value={{ connect, disconnect }}>
      {children}
    </CoinbaseWebSocketContext.Provider>
  );
};
