import { PubSub } from "../infra/PubSub";
import { Signal } from "../infra/Signal";
import { AssetPair } from "../base/Asset";
import { Trade } from "../base/Trade";
import { NWave } from "../base/Wavelet";

export class Signal_P<A extends AssetPair> extends Signal<Trade<A>, NWave<A>> {
  constructor(source: PubSub<Trade<A>>) {
    super(source);
  }

  protected process(signal: Trade<A>): void {
    this.publish(new NWave<A>(signal.price, signal.timestamp));
  }
}