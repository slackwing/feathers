import React from 'react';
import styles from '../page.module.css';
import { Side, Order, BookType } from '@/lib/base/Order';

interface OrderFormProps {
  side: Side;
  onSubmit: (order: Order) => void;
}

export default function OrderForm({ side, onSubmit }: OrderFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const price = parseFloat((form.elements.namedItem('price') as HTMLInputElement).value);
    const amount = parseFloat((form.elements.namedItem('amount') as HTMLInputElement).value);
    
    if (isNaN(price) || isNaN(amount) || price <= 0 || amount <= 0) {
      alert('Invalid price or amount.');
      return;
    }

    const orderId = "P" + side + "-" + new Date().toISOString().slice(2,16).replace(/[-]/g,'') + "_" + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    const order = new Order('limit', orderId, side, price, amount, Date.now(), BookType.PAPER);
    onSubmit(order);
  };

  return (
    <form className={styles.orderForm} onSubmit={handleSubmit}>
      <div className={styles.formGroup}>
        <label htmlFor="orderType">Order Type</label>
        <select id="orderType" name="orderType">
          <option value="limit">Limit</option>
          <option value="market" disabled>Market</option>
          <option value="stop" disabled>Stop</option>
        </select>
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="price">Price (USD)</label>
        <input type="number" id="price" name="price" step="0.01" placeholder="Enter price" />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="amount">Amount (BTC)</label>
        <input type="number" id="amount" name="amount" step="0.00000001" placeholder="Enter amount" />
      </div>
      <button type="submit" className={`${styles.orderButton} ${side === Side.BUY ? styles.buy : styles.sell}`}>
        {side === Side.BUY ? 'Buy BTC' : 'Sell BTC'}
      </button>
    </form>
  );
} 