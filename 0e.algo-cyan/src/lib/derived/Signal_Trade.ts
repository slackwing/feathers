import { PubSub } from "../infra/PubSub";
import { AssetPair } from "../base/Asset";
import { Trade } from "../base/Trade";
import { TSignalAdapter_UsingTimestamp } from "../infra/signals/TSignal";

export class Signal_Trade<A extends AssetPair> extends TSignalAdapter_UsingTimestamp<Trade<A>> {
  constructor(source: PubSub<Trade<A>>) {
    super(source);
  }
}