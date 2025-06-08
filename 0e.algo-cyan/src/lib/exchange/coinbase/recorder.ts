import { WebSocket } from 'ws';
import { ExchangeRecorder } from '@/lib/base/recorder/recorder';
import { ExchangeConfig } from '@/lib/base/recorder/types';
import { CoinbaseMessage, COINBASE_WS_URL, createSubscriptionMessage, CoinbaseChannel } from '@/lib/exchange/coinbase/types';

export class CoinbaseRecorder extends ExchangeRecorder {
  private ws: WebSocket;

  constructor(config: ExchangeConfig, dataDir?: string) {
    super(config, dataDir);
    this.ws = new WebSocket(COINBASE_WS_URL);
  }

  async start(): Promise<void> {
    this.setupKeyboardControls();

    this.ws.on('open', () => {
      console.log('Connected to Coinbase WebSocket');
      for (const channel of this.config.channels) {
        this.ws.send(JSON.stringify(createSubscriptionMessage('subscribe', channel as CoinbaseChannel, [this.config.pair])));
      }
    });

    this.ws.on('message', (data: Buffer) => {
      if (!this.isRecording) return;
      this.addMessage(JSON.parse(data.toString()) as CoinbaseMessage);
      this.checkMaxDuration();
    });

    this.ws.on('close', () => {
      this.saveData();
      process.exit(0);
    });

    this.ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      process.exit(1);
    });
  }
} 