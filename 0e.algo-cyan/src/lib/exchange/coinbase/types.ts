import { ExchangeMessage, ExchangeSubscription } from '@/lib/base/recorder/types';

export const COINBASE_WS_URL = 'wss://advanced-trade-ws.coinbase.com';

export const COINBASE_CHANNELS = {
  level2: 'level2',
  market_trades: 'market_trades',
  heartbeats: 'heartbeats'
} as const;

export type CoinbaseChannel = keyof typeof COINBASE_CHANNELS;

export interface CoinbaseMessage extends ExchangeMessage {
  product_id: string;
  events?: Array<{
    updates?: Array<{
      side: string;
      price_level: string;
      new_quantity: string;
    }>;
    trades?: Array<{
      side: string;
      price: string;
      size: string;
    }>;
  }>;
}

export interface CoinbaseSubscription extends ExchangeSubscription {}

export interface CoinbaseWebSocketService {
  connect: (callbacks: {
    onMessage?: (data: CoinbaseMessage) => void;
    onError?: (error: Event) => void;
    onOpen?: () => void;
  }) => void;
  disconnect: () => void;
}

export function createSubscriptionMessage(
  type: 'subscribe' | 'unsubscribe',
  channel: CoinbaseChannel,
  productIds?: string[]
): CoinbaseSubscription {
  return {
    type,
    channel: COINBASE_CHANNELS[channel],
    product_ids: productIds
  };
} 