import React from 'react';
import styles from '../page.module.css';
import { Side, Order, OrderType, ExchangeType } from '@/lib/base/Order';
import { Account } from '@/lib/base/Account';
import { AssetPair } from '@/lib/base/Asset';

interface OrderFormProps {
  account: Account;
  assetPair: AssetPair;
  side: Side;
  onSubmit: (order: Order) => void;
}

export default function OrderForm({ account, assetPair, side, onSubmit }: OrderFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const price = parseFloat((form.elements.namedItem('price') as HTMLInputElement).value);
    const amount = parseFloat((form.elements.namedItem('amount') as HTMLInputElement).value);

    if (isNaN(price) || isNaN(amount) || price <= 0 || amount <= 0) {
      alert('Invalid price or amount.');
      return;
    }

    // TODO(P1): Factor out order ID generation.
    const orderId =
      'P' +
      side +
      '-' +
      new Date().toISOString().slice(2, 16).replace(/[-]/g, '') +
      '_' +
      String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    const order = new Order(account, OrderType.PAPER, ExchangeType.LIMIT, assetPair, side, price, amount, Date.now());
    onSubmit(order);
  };

  return (
    <form className={styles.orderForm} onSubmit={handleSubmit}>
      <div className={styles.formGroup}>
        <label htmlFor="orderType">Order Type</label>
        <select id="orderType" name="orderType">
          <option value="limit">Limit</option>
          <option value="market" disabled>
            Market
          </option>
          <option value="stop" disabled>
            Stop
          </option>
        </select>
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="price">Price (USD)</label>
        <input type="number" id="price" name="price" step="0.01" placeholder="Enter price" />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="amount">Amount (BTC)</label>
        <input
          type="number"
          id="amount"
          name="amount"
          step="0.00000001"
          placeholder="Enter amount"
        />
      </div>
      <button
        type="submit"
        className={`${styles.orderButton} ${side === Side.BUY ? styles.buy : styles.sell}`}
      >
        {side === Side.BUY ? 'Buy BTC' : 'Sell BTC'}
      </button>
    </form>
  );
}
