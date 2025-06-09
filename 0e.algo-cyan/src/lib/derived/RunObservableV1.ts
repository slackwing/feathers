import { Observable } from "../base/Observable";
import { ReadOnlyPubSub } from "../infra/PubSub";

export interface RunObservableV1 extends Observable {
  getMinorMajorEventFeed(): ReadOnlyPubSub<boolean>;
}
