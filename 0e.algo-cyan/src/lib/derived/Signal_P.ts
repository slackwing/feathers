import { PubSub } from "../infra/PubSub";
import { Signal } from "../infra/Signal";
import { AssetPair } from "../base/Asset";
import { Trade } from "../base/Trade";
import { WaveletN } from "../base/Wavelet";

export class Signal_P<A extends AssetPair> extends Signal<Trade<A>, WaveletN<A>> {
  constructor(source: PubSub<Trade<A>>) {
    super(source);
  }

  protected process(signal: Trade<A>): void {
    this.publish(new WaveletN<A>(signal.price, signal.timestamp));
  }
}