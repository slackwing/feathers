import { MutableSortedTreeMap } from '../infra/MutableSortedTreeMap';
import { AssetPair } from './Asset';
import { Order, Side } from './Order';

export class OrderPriceTimePriorityTree<A extends AssetPair> implements Iterable<Order<A>> {
  readonly assetPair: A;
  private side: Side;
  private orders: MutableSortedTreeMap<Order<A>>;
  private timings: {
    upsertOrder: number;
    iterator: number;
  };

  constructor(assetPair: A, side: Side) {
    this.assetPair = assetPair;
    this.side = side;
    this.orders = new MutableSortedTreeMap<Order<A>>((orderA, orderB) => {
      const priceA = this.side === Side.BUY ? -orderA.price : orderA.price;
      const priceB = this.side === Side.BUY ? -orderB.price : orderB.price;

      if (priceA !== priceB) return priceA - priceB;
      return orderA.timestamp - orderB.timestamp;
    });
    this.timings = {
      upsertOrder: 0,
      iterator: 0,
    };
  }

  upsertOrder(order: Order<A>): void {
    const start = performance.now();
    if (order.remainingQty <= 0) {
      this.orders.remove(order.id);
    } else {
      this.orders.set(order.id, order);
    }
    this.timings.upsertOrder += performance.now() - start;
  }

  [Symbol.iterator](): Iterator<Order<A>> {
    const start = performance.now();
    const iterator = this.orders[Symbol.iterator]();
    const result = {
      next: (): IteratorResult<Order<A>> => {
        const next = iterator.next();
        if (next.done) {
          return { done: true, value: undefined };
        }
        const [, order] = next.value;
        if (!order) {
          return result.next();
        }
        return { value: order, done: false };
      },
    };
    this.timings.iterator += performance.now() - start;
    return result;
  }

  getTimings(): { upsertOrder: number; iterator: number } {
    return {
      ...this.timings,
    };
  }

  resetTimings(): void {
    this.timings = {
      upsertOrder: 0,
      iterator: 0,
    };
  }

  first(n: number): Order<A>[] {
    const result: Order<A>[] = [];
    const seenIds = new Map<string, number>();
    let count = 0;
    for (const order of this) {
      if (count++ >= n) break;
      if (seenIds.has(order.id)) {
        // TODO(P3): Consider turning into assertion.
        console.log(`Duplicate order ID found: ${order.id} (seen ${seenIds.get(order.id)} times)`);
      }
      seenIds.set(order.id, (seenIds.get(order.id) || 0) + 1);
      result.push(order);
    }
    return result;
  }

  until(price: number): Order<A>[] {
    const result: Order<A>[] = [];
    for (const order of this) {
      if (this.side === Side.BUY ? order.price >= price : order.price <= price) result.push(order);
      else break;
    }
    return result;
  }
}
