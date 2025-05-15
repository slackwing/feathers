import { PubSub } from '@/lib/infra/PubSub';
import { Order, Side, OrderType, ExchangeType } from '@/lib/base/Order';
import { Trade } from '@/lib/base/Trade';
import { Asset, AssetPair } from '@/lib/base/Asset';
import { Account, NullAccount } from '@/lib/base/Account';
export class CoinbaseDataAdapter {
  private orderFeed: PubSub<Order>;
  private tradeFeed: PubSub<Trade>;
  private nullAccount: Account;
  private assetPair: AssetPair; // TODO(P1): Currently hardcoded to BTC-USD.

  constructor() {
    this.orderFeed = new PubSub<Order>();
    this.tradeFeed = new PubSub<Trade>();
    this.nullAccount = new NullAccount();
    this.assetPair = new AssetPair(Asset.BTC, Asset.USD);
  }

  onMessage(data: any) {
    if (data.channel === 'l2_data') {
      const event = data.events[0];
      event.updates.forEach((update: any) => {
        const order = new Order(
          this.nullAccount,
          OrderType.L2,
          ExchangeType.LIMIT,
          this.assetPair,
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

  getL2OrderFeed(): PubSub<Order> {
    return this.orderFeed;
  }

  getTradeFeed(): PubSub<Trade> {
    return this.tradeFeed;
  }
}
