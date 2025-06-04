import { PubSub } from '@/lib/infra/PubSub';
import { Order, Side, OrderType, ExchangeType } from '@/lib/base/Order';
import { Trade } from '@/lib/base/Trade';
import { AssetPair } from '@/lib/base/Asset';
import { Account, InfiniteAccount } from '@/lib/base/Account';

export class CoinbaseDataAdapter<T extends AssetPair> {
  readonly assetPair: T;
  private orderFeed: PubSub<Order<T>>;
  private tradeFeed: PubSub<Trade<T>>;
  private infiniteAccount: Account;

  private readonly latencyWindow = 100;
  private latencyRingBuffer: number[] = new Array(this.latencyWindow);
  private latencySum = 0;
  private latencyRingBufferIdx = 0;
  private latencyRingBufferCount = 0;
  private latencyLastLogged = Date.now();
  private msgCountL2Data = 0;
  private msgCountTrades = 0;
  private orderCount = 0;
  private tradeCount = 0;

  constructor(assetPair: T) {
    this.assetPair = assetPair;
    this.orderFeed = new PubSub<Order<T>>();
    this.tradeFeed = new PubSub<Trade<T>>();
    this.infiniteAccount = new InfiniteAccount();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onMessage(data: any) {
    const startTime = performance.now();
    if (data.channel !== 'l2_data' && data.channel !== 'market_trades') {
      return;
    }
    if (data.channel === 'l2_data') {
      this.msgCountL2Data++;
      const event = data.events[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event.updates.forEach((update: any) => {
        this.orderCount++;
        const order = new Order<T>(
          this.assetPair,
          this.infiniteAccount,
          OrderType.L2,
          ExchangeType.LIMIT,
          update.side === 'bid' ? Side.BUY : Side.SELL,
          parseFloat(update.price_level),
          parseFloat(update.new_quantity),
          data.timestamp
        );
        this.orderFeed.publish(order);
      });
    } else if (data.channel === 'market_trades') {
      this.msgCountTrades++;
      const event = data.events[0];
      // TODO(P3):Coinbase trades are in reverse chronological order. Platformize.
      for (let i = event.trades.length - 1; i >= 0; i--) {
        this.tradeCount++;
        const trade = event.trades[i];
        const side = trade.side === 'BUY' ? Side.BUY : Side.SELL;
        const price = parseFloat(trade.price);
        const quantity = parseFloat(trade.size);
        const timestamp = Date.now();
        this.tradeFeed.publish(new Trade(this.assetPair, side, price, quantity, timestamp));
      }
    }
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    if (this.latencyRingBufferCount < this.latencyWindow) {
      this.latencyRingBuffer[this.latencyRingBufferIdx] = processingTime;
      this.latencyRingBufferCount++;
    } else {
      this.latencySum -= this.latencyRingBuffer[this.latencyRingBufferIdx];
      this.latencyRingBuffer[this.latencyRingBufferIdx] = processingTime;
    }
    this.latencySum += processingTime;
    this.latencyRingBufferIdx = (this.latencyRingBufferIdx + 1) % this.latencyWindow;
    
    const now = Date.now();
    if (now - this.latencyLastLogged >= 5000) {
      // const timeDiff = (now - this.latencyLastLogged) / 1000;
      // console.log(`>>> LATENCY (n=${this.latencyRingBufferCount}): ${this.latencySum / this.latencyRingBufferCount}ms`);
      // console.log(`>>> MESSAGES: ${(this.msgCountL2Data / timeDiff).toFixed(1)} l2_data/s; ${(this.msgCountTrades / timeDiff).toFixed(1)} market_trades/s`);
      // console.log(`>>> ENTITIES: ${(this.orderCount / timeDiff).toFixed(1)} order/s; ${(this.tradeCount / timeDiff).toFixed(1)} trade/s`);
      this.latencyLastLogged = now;
      this.msgCountL2Data = 0;
      this.msgCountTrades = 0;
      this.orderCount = 0;
      this.tradeCount = 0;
    }
  }

  getL2OrderFeed(): PubSub<Order<T>> {
    return this.orderFeed;
  }

  getTradeFeed(): PubSub<Trade<T>> {
    return this.tradeFeed;
  }
}
