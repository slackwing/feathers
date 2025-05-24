import assert from "assert";
import { Asset } from "./Asset";
import { deleteSelf } from "../utils/delete";
import { gt, lt, round } from "../utils/number";

export type Funds = Map<Asset, Fund>;

export class Fund {
  readonly asset: Asset;
  readonly amount: number;

  constructor(asset: Asset, amount: number) {
    this.asset = asset;
    this.amount = round(amount);
  }
}

export function safelyDepositFunds(funds: Fund, to: Funds): void {
  if (to.has(funds.asset)) {
    const originalFund = to.get(funds.asset);
    assert.ok(originalFund !== undefined, 'IMPOSSIBLE: originalFund should not be undefined.');
    const updatedFund = new Fund(funds.asset, originalFund.amount + funds.amount);
    to.set(funds.asset, updatedFund);
    deleteSelf(originalFund); // Make original funds unusable.
  } else {
    to.set(funds.asset, funds);
  }
}

export function safelyWithdrawFunds(asset: Asset, amount: number, from: Funds): Fund {
  if (!from.has(asset)) {
    throw new Error(`No fund for asset ${asset}; requested ${amount}.`);
  }
  const originalFund = from.get(asset);
  assert.ok(originalFund !== undefined, 'IMPOSSIBLE: originalFund should not be undefined.');
  if (lt(originalFund.amount - amount, 0)) {
    throw new Error(`Insufficient funds for asset ${asset}; requested ${amount}.`);
  }
  const withdrawnFund = new Fund(asset, amount);
  if (gt(originalFund.amount - amount, 0)) {
    const updatedFund = new Fund(asset, originalFund.amount - amount);
    from.set(asset, updatedFund);
  } else {
    from.delete(asset);
  }
  deleteSelf(originalFund); // Make original funds unusable.
  return withdrawnFund;
}
