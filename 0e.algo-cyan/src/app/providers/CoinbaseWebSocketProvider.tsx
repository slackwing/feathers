'use client';

import * as React from 'react';
import { createContext, useEffect, useRef, useCallback } from 'react';
import { COINBASE_WS_URL, CoinbaseMessage, CoinbaseWebSocketService, createSubscriptionMessage } from '@/lib/exchange/coinbase/CoinbaseTypes';

export const CoinbaseWebSocketContext = createContext<CoinbaseWebSocketService | null>(null);

export const CoinbaseWebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(
    (callbacks: {
      onMessage?: (data: CoinbaseMessage) => void;
      onError?: (error: Event) => void;
      onOpen?: () => void;
    }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      const ws = new WebSocket(COINBASE_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to Coinbase WebSocket.');
        callbacks.onOpen?.();

        ws.send(JSON.stringify(createSubscriptionMessage('subscribe', 'heartbeats')));
        ws.send(JSON.stringify(createSubscriptionMessage('subscribe', 'level2', ['BTC-USD'])));
        ws.send(JSON.stringify(createSubscriptionMessage('subscribe', 'market_trades', ['BTC-USD'])));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data) as CoinbaseMessage;
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
      wsRef.current.send(JSON.stringify(createSubscriptionMessage('unsubscribe', 'level2', ['BTC-USD'])));
      wsRef.current.send(JSON.stringify(createSubscriptionMessage('unsubscribe', 'market_trades', ['BTC-USD'])));
      wsRef.current.send(JSON.stringify(createSubscriptionMessage('unsubscribe', 'heartbeats')));

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
