export interface ExchangeMessage {
  type: string;
  channel: string;
  timestamp?: string;
}

export interface ExchangeConfig {
  exchange: string;
  channels: string[];
  pair: string;
  fileSizeBytes: number;
}

export interface ExchangeSubscription {
  type: 'subscribe' | 'unsubscribe';
  channel: string;
  product_ids?: string[];
}

export interface ExchangeConnection {
  connect: (callbacks: {
    onMessage?: (data: ExchangeMessage) => void;
    onError?: (error: Event) => void;
    onOpen?: () => void;
  }) => void;
  disconnect: () => void;
  subscribe: (channel: string, productIds?: string[]) => void;
  unsubscribe: (channel: string, productIds?: string[]) => void;
} 