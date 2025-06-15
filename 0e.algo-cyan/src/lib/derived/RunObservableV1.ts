import { IntelligenceV1 } from "../base/Intelligence";
import { Observable } from "../base/Observable";
import { ReadOnlyPubSub } from "../infra/PubSub";

export interface IntelligentV1 extends Observable {
  getIntelligenceFeed(): ReadOnlyPubSub<IntelligenceV1>;
}
