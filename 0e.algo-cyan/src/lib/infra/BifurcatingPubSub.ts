import { Cloneable } from "./Cloneable";
import { PubSub } from "./PubSub";

/**
 * NOTE(DECOMMISSIONED): This was an experimental strategy to split paper orders
 * across hypothetical worlds. However, once Account was added, it became
 * apparent that the strategy was misguided. Cloning the account meant a
 * transaction on either of the bifurcated paper orders counted against a shared
 * account. This revealed that paper orders _weren't_ really the "same thing"
 * being reflected across worlds; they were distinct objects belonging to
 * distinct accounts.
 */
export class BifurcatingPubSub<T extends Cloneable<T>> extends PubSub<T> {

  // TODO(P2): How to make PubSubs that are read-only to be passed around?
  publish(data: T): void {
    for (const callback of this._listeners) {
      callback(data.clone()); // Always a copy of the data!
    }
  }
}
