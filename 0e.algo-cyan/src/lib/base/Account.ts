import { Fund, FundLog, Funds, safelyDepositFunds, safelyWithdrawFunds } from "./Funds";
import { Asset } from "./Asset";
import { Quotes } from "./Quotes";
import { Order } from "./Order";
import { PubSub, ReadOnlyPubSub } from "../infra/PubSub";

export class Account {
  public readonly id: string;
  public readonly name: string;
  private readonly wallets: Map<string, Wallet>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly orders: Map<string, Order<any>>;
  private readonly transactionsFeed: PubSub<FundLog>;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.wallets = new Map<string, Wallet>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.orders = new Map<string, Order<any>>();
    this.transactionsFeed = new PubSub<FundLog>();
  }

  public addWallet(wallet: Wallet): void {
    if (this.wallets.has(wallet.id)) {
      throw new Error(`Wallet ${wallet.id} already exists.`);
    } else {
      this.wallets.set(wallet.id, wallet);
    }
  }

  private getActiveWallet(): Wallet {
    const wallet = this.wallets.values().next().value;
    if (!wallet) {
      throw new Error('No wallets available.');
    }
    return wallet;
  }

  public depositAsset(fund: Fund): void {
    this.getActiveWallet().depositAsset(fund);
    this.transactionsFeed.publish(new FundLog(fund.asset, fund.amount));
  }

  public withdrawAsset(asset: Asset, amount: number): Fund {
    this.transactionsFeed.publish(new FundLog(asset, -1 * amount));
    return this.getActiveWallet().withdrawAsset(asset, amount);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public orderFunded(order: Order<any>): void {
    this.orders.set(order.id, order);
  }

  public computeTotalValue(quotes: Quotes): number {
    const walletValue = this.wallets.values().reduce((acc, wallet) => acc + wallet.computeValue(quotes), 0);
    const orderValue = Array.from(this.orders.values()).reduce((acc, order) => acc + order.computeValue(quotes), 0);
    return walletValue + orderValue;
  }

  /**
   * NOTE(UNUSED): Added for a certain purpose but then changed courses.
   */
  public computeHeldValue(quotes: Quotes): number {
    return Array.from(this.orders.values()).reduce((acc, order) => acc + order.computeValue(quotes), 0);
  }

  /**
   * NOTE(UNUSED): Added for a certain purpose but then changed courses.
   */
  public getTransactionsFeed(): ReadOnlyPubSub<FundLog> {
    return this.transactionsFeed;
  }
}

export class Wallet {
  readonly id: string;
  readonly name: string;
  private _assets: Funds;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this._assets = new Map<Asset, Fund>();
  }

  public depositAsset(funds: Fund): void {
    safelyDepositFunds(funds, this._assets);
  }

  public withdrawAsset(asset: Asset, amount: number): Fund {
    return safelyWithdrawFunds(asset, amount, this._assets);
  }

  public computeValue(quotes: Quotes): number {
    return quotes.computeValue(this._assets);
  }
}

export class NullAccount extends Account {
  constructor() {
    super('nullAccount', 'Null Account');
    this.addWallet(new NullWallet());
  }
}

export class InfiniteAccount extends Account {
  constructor() {
    super('infiniteAccount', 'Infinite Account');
    this.addWallet(new InfiniteWallet());
  }
}

export class NullWallet extends Wallet {
  constructor() {
    super('nullWallet', 'Null Wallet');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public depositAsset(funds: Fund): void {
    throw new Error('NullWallet does not support deposits.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public withdrawAsset(asset: Asset, amount: number): Fund {
    throw new Error('NullWallet does not support withdrawals.');
  }
}

export class InfiniteWallet extends Wallet {
  constructor() {
    super('infiniteWallet', 'Infinite Wallet');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public depositAsset(funds: Fund): void {
    // Do nothing.
  }

  public withdrawAsset(asset: Asset, amount: number): Fund {
    return new Fund(asset, amount);
  }
}
