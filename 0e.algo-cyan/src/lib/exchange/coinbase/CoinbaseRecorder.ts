import { WebSocket } from 'ws';
import { ExchangeConfig, ExchangeRecorder } from '@/lib/derived/ExchangeRecorder';
import { CoinbaseMessage, COINBASE_WS_URL, createSubscriptionMessage, CoinbaseChannel } from '@/lib/exchange/coinbase/CoinbaseTypes';

export class CoinbaseRecorder extends ExchangeRecorder {
  private ws: WebSocket;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 12; // 1 + 2 + 4 + 8 + 16 + 32 + 64 + 128 + 256 + 512 + 1024 + 2048 = ~68 minutes
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(config: ExchangeConfig, dataDir?: string) {
    super(config, dataDir);
    this.ws = new WebSocket(COINBASE_WS_URL);
  }

  private async reconnect() {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.log('Max reconnection attempts reached. Quitting...');
      this.cleanup();
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 3600000); // Max 1 hour
    console.log(`Attempting to reconnect in ${delay/1000} seconds...`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}`);
      
      this.saveData();
      this.fileCounter = 1;
      
      this.ws = new WebSocket(COINBASE_WS_URL);
      this.setupWebSocket();
      this.setupKeyboardControls(); // Re-setup keyboard controls after reconnection
    }, delay);
  }

  private setupWebSocket() {
    this.ws.on('open', () => {
      console.log('Connected to Coinbase WebSocket');
      this.reconnectAttempts = 0; // Reset exponential backoff after successful connection
      this.ws.send(JSON.stringify(createSubscriptionMessage('subscribe', 'heartbeats')));
      for (const channel of this.config.channels) {
        this.ws.send(JSON.stringify(createSubscriptionMessage('subscribe', channel as CoinbaseChannel, [this.config.pair])));
      }
    });

    this.ws.on('message', (data: Buffer) => {
      if (!this.isRecording) return;
      try {
        this.addMessage(JSON.parse(data.toString()) as CoinbaseMessage);
      } catch (error) {
        console.error('Failed to parse message:', error);
        console.error('Raw message:', data.toString());
      }
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      console.log(`WebSocket closed with code ${code} and reason: ${reason.toString()}`);
      this.reconnect();
    });

    this.ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      this.reconnect();
    });
  }

  async start(): Promise<void> {
    this.setupKeyboardControls();
    this.setupWebSocket();
  }

  protected cleanup() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    super.cleanup();
  }
} 