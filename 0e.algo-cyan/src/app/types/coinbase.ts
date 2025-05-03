export interface CoinbaseWebSocketService {
  connect: (callbacks: {
    onMessage?: (data: any) => void;
    onError?: (error: Event) => void;
    onOpen?: () => void;
  }) => void;
  disconnect: () => void;
} 