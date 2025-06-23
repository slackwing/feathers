import { Fund, FundLog, Funds, safelyDepositFunds, safelyWithdrawFunds } from "./Funds";
import { Asset } from "./Asset";
import { Quotes } from "./Quotes";
import { Order, OrderStatus } from "./Order";
import { PubSub, ReadOnlyPubSub } from "../infra/PubSub";
import { generateId } from "../utils/id";

export class Account {
  public readonly id: string;
  private readonly _name: string | null;
  protected readonly _wallets: Map<string, Wallet>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected readonly _orders: Map<string, Order<any>>;
  protected readonly _transactionsFeed: PubSub<FundLog>;

  constructor(name?: string) {
    this.id = generateId('ACCOUNT');
    this._name = name ?? null;
    this._wallets = new Map<string, Wallet>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._orders = new Map<string, Order<any>>();
    this._transactionsFeed = new PubSub<FundLog>();
  }

  public get name(): string { return this._name ?? this.id; }

  public addWallet(wallet: Wallet): void {
    if (this._wallets.has(wallet.id)) {
      throw new Error(`Wallet ${wallet.id} already exists.`);
    } else {
      this._wallets.set(wallet.id, wallet);
    }
  }

  private getActiveWallet(): Wallet {
    const wallet = this._wallets.values().next().value;
    if (!wallet) {
      throw new Error('No wallets available.');
    }
    return wallet;
  }

  public depositAsset(fund: Fund): void {
    this.getActiveWallet().depositAsset(fund);
    this._transactionsFeed.publish(new FundLog(fund.asset, fund.amount));
  }

  public withdrawAsset(asset: Asset, amount: number): Fund {
    this._transactionsFeed.publish(new FundLog(asset, -1 * amount));
    return this.getActiveWallet().withdrawAsset(asset, amount);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public orderFunded(order: Order<any>): void {
    this._orders.set(order.id, order);
  }

  public computeTotalValue(quotes: Quotes): number {
    const walletValue = this._wallets.values().reduce((acc, wallet) => acc + wallet.computeValue(quotes), 0);
    const orderValue = Array.from(this._orders.values())
      .filter(order => order.status === OrderStatus.OPEN)
      .reduce((acc, order) => acc + order.computeValue(quotes), 0);
    return walletValue + orderValue;
  }

  /**
   * NOTE(UNUSED): Added for a certain purpose but then changed courses.
   */
  public computeHeldValue(quotes: Quotes): number {
    return Array.from(this._orders.values()).reduce((acc, order) => acc + order.computeValue(quotes), 0);
  }

  /**
   * NOTE(UNUSED): Added for a certain purpose but then changed courses.
   */
  public getTransactionsFeed(): ReadOnlyPubSub<FundLog> {
    return this._transactionsFeed;
  }
}

export class Wallet {
  public readonly id: string;
  private readonly _name: string | null;
  private _assets: Funds;

  constructor(name?: string) {
    this.id = generateId('W');
    this._name = name ?? null;
    this._assets = new Map<Asset, Fund>();
  }

  public get name(): string { return this._name ?? this.id; }

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
    super();
    this.addWallet(new NullWallet());
  }
}

export class InfiniteAccount extends Account {
  constructor() {
    super();
    this.addWallet(new InfiniteWallet());
  }
}

export class NullWallet extends Wallet {
  constructor() {
    super();
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
    super();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public depositAsset(funds: Fund): void {
    // Do nothing.
  }

  public withdrawAsset(asset: Asset, amount: number): Fund {
    return new Fund(asset, amount);
  }
}
