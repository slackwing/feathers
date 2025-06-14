import { PubSub } from '@/lib/infra/PubSub';
import { Order, Side, OrderType, ExchangeType } from '@/lib/base/Order';
import { Trade } from '@/lib/base/Trade';
import { AssetPair } from '@/lib/base/Asset';
import { Account, InfiniteAccount } from '@/lib/base/Account';
import { CoinbaseMessage } from '@/lib/exchange/coinbase/types';

export class FileDataAdapter<A extends AssetPair> {
  private l2OrderFeed: PubSub<Order<A>>;
  private tradeFeed: PubSub<Trade<A>>;
  private assetPair: A;
  private infiniteAccount: Account;

  constructor(assetPair: A) {
    this.assetPair = assetPair;
    this.l2OrderFeed = new PubSub<Order<A>>();
    this.tradeFeed = new PubSub<Trade<A>>();
    this.infiniteAccount = new InfiniteAccount();
  }

  getL2OrderFeed(): PubSub<Order<A>> {
    return this.l2OrderFeed;
  }

  getTradeFeed(): PubSub<Trade<A>> {
    return this.tradeFeed;
  }

  onMessage(data: CoinbaseMessage) {
    if (data.channel === 'l2_data' && data.events?.[0]?.updates) {
      const event = data.events[0];
      const updates = event.updates;
      if (updates) {
        updates.forEach((update) => {
          const order = new Order(
            this.assetPair,
            this.infiniteAccount,
            OrderType.L2,
            ExchangeType.LIMIT,
            update.side === 'bid' ? Side.BUY : Side.SELL,
            parseFloat(update.price_level),
            parseFloat(update.new_quantity),
            typeof data.timestamp === 'string' ? new Date(data.timestamp).getTime() : Date.now()
          );
          this.l2OrderFeed.publish(order);
        });
      }
    } else if (data.channel === 'market_trades' && data.events?.[0]?.trades) {
      const event = data.events[0];
      const trades = event.trades;
      if (trades) {
        // TODO(P3): Coinbase trades are in reverse chronological order. Platformize.
        for (let i = trades.length - 1; i >= 0; i--) {
          const trade = trades[i];
          const side = trade.side === 'BUY' ? Side.BUY : Side.SELL;
          const price = parseFloat(trade.price);
          const quantity = parseFloat(trade.size);
          const timestamp = typeof data.timestamp === 'string' ? new Date(data.timestamp).getTime() : Date.now();
          this.tradeFeed.publish(new Trade(this.assetPair, side, price, quantity, timestamp));
        }
      }
    }
  }

  async loadFile(files: File[]): Promise<void> {
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

    for (const file of files) {
      let offset = 0;
      let buffer = '';

      while (offset < file.size) {
        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        const text = await chunk.text();
        buffer += text;

        // Split buffer into lines and process each line as a separate JSON object
        const lines = buffer.split('\n');
        // Keep the last line in the buffer as it might be incomplete
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {  // Skip empty lines
            try {
              const data = JSON.parse(line);
              this.onMessage(data);
            } catch (error) {
            }
          }
        }

        offset += CHUNK_SIZE;
      }

      // Process any remaining data in the buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          this.onMessage(data);
        } catch (error) {
        }
      }
    }
  }
} 