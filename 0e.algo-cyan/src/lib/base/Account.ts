import { Fund, Funds, safelyDepositFunds, safelyWithdrawFunds } from "./Funds";
import { Asset } from "./Asset";

export class Account {
  readonly id: string;
  readonly name: string;
  readonly wallets: Map<string, Wallet>;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.wallets = new Map<string, Wallet>();
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

  public depositAsset(funds: Fund): void {
    this.getActiveWallet().depositAsset(funds);
  }

  public withdrawAsset(asset: Asset, amount: number): Fund {
    return this.getActiveWallet().withdrawAsset(asset, amount);
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
