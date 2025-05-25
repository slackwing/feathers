import { AssetPair } from "../base/Asset";
import { Trade } from "../base/Trade";
import { TSignal } from "../infra/signals/TSignal";
import { ANWave } from "../base/Wavelets";
import { Wavelet } from "../infra/Wavelet";

/* eslint-disable @typescript-eslint/no-explicit-any */
export class Signal_P<A extends AssetPair> extends TSignal<Trade<A>, number> {
  constructor(source: TSignal<any, Trade<A>>) {
    super(source);
  }

  protected process(source: number, signal: Wavelet<Trade<A>>): void {
    this.broadcast(new ANWave<A>(signal.value.price, signal.timestamp));
  }
}
