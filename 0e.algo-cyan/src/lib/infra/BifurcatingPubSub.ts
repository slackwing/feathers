import { Cloneable } from "./Cloneable";
import { PubSub } from "./PubSub";

export class BifurcatingPubSub<T extends Cloneable<T>> extends PubSub<T> {

  // TODO(P2): How to make PubSubs that are read-only to be passed around?
  publish(data: T): void {
    for (const callback of this.subscribers) {
      callback(data.clone()); // Always a copy of the data!
    }
  }
}
