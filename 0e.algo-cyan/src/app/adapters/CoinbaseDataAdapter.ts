import { PubSub } from '@/lib/infra/PubSub';
import { Order, Side, OrderType, ExchangeType } from '@/lib/base/Order';
import { Trade } from '@/lib/base/Trade';
import { AssetPair } from '@/lib/base/Asset';
import { Account, InfiniteAccount } from '@/lib/base/Account';

export class CoinbaseDataAdapter<T extends AssetPair> {
  readonly assetPair: T;
  private orderFeed: PubSub<Order<T>>;
  private tradeFeed: PubSub<Trade>;
  private infiniteAccount: Account;

  constructor(assetPair: T) {
    this.assetPair = assetPair;
    this.orderFeed = new PubSub<Order<T>>();
    this.tradeFeed = new PubSub<Trade>();
    this.infiniteAccount = new InfiniteAccount();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onMessage(data: any) {
    if (data.channel === 'l2_data') {
      const event = data.events[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event.updates.forEach((update: any) => {
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
      const event = data.events[0];
      // TODO(P3):Coinbase trades are in reverse chronological order. Platformize.
      for (let i = event.trades.length - 1; i >= 0; i--) {
        const trade = event.trades[i];
        const side = trade.side === 'BUY' ? Side.BUY : Side.SELL;
        const price = parseFloat(trade.price);
        const quantity = parseFloat(trade.size);
        const timestamp = Date.now();
        this.tradeFeed.publish(new Trade(side, price, quantity, timestamp));
      }
    }
  }

  getL2OrderFeed(): PubSub<Order<T>> {
    return this.orderFeed;
  }

  getTradeFeed(): PubSub<Trade> {
    return this.tradeFeed;
  }
}
