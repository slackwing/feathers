import { Funds } from "./Asset";
import { deleteSelf } from "../utils/delete";
import { Asset } from "./Asset";

export class Account {
  readonly id: string;
  readonly name: string;
  readonly wallets: Map<string, Wallet>;
  private _primaryWallet: Wallet | null;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.wallets = new Map<string, Wallet>();
    this._primaryWallet = null;
  }

  public addWallet(wallet: Wallet): void {
    if (this.wallets.has(wallet.id)) {
      throw new Error(`Wallet ${wallet.id} already exists.`);
    } else {
      if (this.wallets.size === 0) {
        this._primaryWallet = wallet;
      }
      this.wallets.set(wallet.id, wallet);
    }
  }

  get primaryWallet(): Wallet {
    if (!this._primaryWallet) {
      throw new Error('Primary wallet not set.');
    }
    return this._primaryWallet;
  }
}

export class Wallet {
  readonly id: string;
  readonly name: string;
  readonly assets: Map<Asset, number>;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.assets = new Map<Asset, number>();
  }

  // TODO(P1): Temporary method; actual implementation should audit.
  // Consider creating a class called Transactional that is used
  // to handle all transfers at once.
  public depositAsset(funds: Funds): void {
    const current = this.assets.get(funds.asset) || 0;
    this.assets.set(funds.asset, current + funds.amount);
    deleteSelf(funds); // Ensure funds can't be used again, even outside this scope.
  }

  public withdrawAsset(asset: Asset, amount: number): Funds {
    const current = this.assets.get(asset) || 0;
    if (current < amount) {
      throw new Error(`Insufficient balance ${current} for asset ${asset}, requested ${amount}.`);
    }
    this.assets.set(asset, current - amount);
    return new Funds(asset, amount);
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
  public depositAsset(funds: Funds): void {
    throw new Error('NullWallet does not support deposits.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public withdrawAsset(asset: Asset, amount: number): Funds {
    throw new Error('NullWallet does not support withdrawals.');
  }
}

export class InfiniteWallet extends Wallet {
  constructor() {
    super('infiniteWallet', 'Infinite Wallet');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public depositAsset(funds: Funds): void {
    // Do nothing.
  }

  public withdrawAsset(asset: Asset, amount: number): Funds {
    return new Funds(asset, amount);
  }
}
