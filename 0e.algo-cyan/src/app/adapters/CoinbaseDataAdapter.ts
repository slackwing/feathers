import { PubSub } from '@/lib/infra/PubSub';
import { Order, Side, BookType } from '@/lib/base/Order';
import { Trade } from '@/lib/base/Trade';

export class CoinbaseDataAdapter {
    private orderFeed: PubSub<Order>;
    private tradeFeed: PubSub<Trade>;

    constructor() {
        this.orderFeed = new PubSub<Order>();
        this.tradeFeed = new PubSub<Trade>();
    }

    onMessage(data: any) {
        if (data.channel === 'l2_data') {
            const event = data.events[0];
            event.updates.forEach((update: any) => {
                const price = parseFloat(update.price_level);
                const quantity = parseFloat(update.new_quantity);
                const side = update.side === 'bid' ? Side.BUY : Side.SELL;
                const priceStr = price.toLocaleString('fullwide', {useGrouping: false});
                const id = "L2" + side + "-" + priceStr;

                const order = new Order(
                    'limit',
                    id,
                    side,
                    price,
                    quantity,
                    data.timestamp,
                    BookType.L2
                );
                this.orderFeed.publish(order);
            });
        } else if (data.channel === 'market_trades') {
            const event = data.events[0];
            event.trades.forEach((trade: any) => {
                const price = parseFloat(trade.price);
                const quantity = parseFloat(trade.size);
                const timestamp = Date.now();

                const domainTrade = new Trade(price, quantity, timestamp);
                this.tradeFeed.publish(domainTrade);
            });
        }
    }

    getL2OrderFeed(): PubSub<Order> {
        return this.orderFeed;
    }

    getTradeFeed(): PubSub<Trade> {
        return this.tradeFeed;
    }
} 