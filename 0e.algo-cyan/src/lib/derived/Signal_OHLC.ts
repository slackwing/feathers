import { AssetPair } from "../base/Asset";
import { Interval } from "../base/Interval";
import { OHLC } from "../base/OHLC";
import { AOHLCWave } from "../base/Wavelets";
import { DSignal } from "../infra/signals/DSignal";
import { Wavelet } from "../infra/Wavelet";
import { Signal_C } from "./Signal_C";
import { Signal_H } from "./Signal_H";
import { Signal_L } from "./Signal_L";
import { Signal_O } from "./Signal_O";
import { Signal_P } from "./Signal_P";

export class Signal_OHLC<A extends AssetPair, I extends Interval> extends DSignal<number, OHLC, I> {

  constructor(source: Signal_P<A>, interval: I) {
    super(
      new Signal_O(source, interval),
      new Signal_H(source, interval),
      new Signal_L(source, interval),
      new Signal_C(source, interval)
    );
  }

  protected onAlignment(values: Wavelet<number>[]): void {
    this.broadcast(
      new AOHLCWave<A>(
        new OHLC(values[0].value, values[1].value, values[2].value, values[3].value),
        values[0].timestamp
      )
    );
  }
}