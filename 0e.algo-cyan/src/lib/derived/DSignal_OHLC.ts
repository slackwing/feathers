import { AssetPair } from "../base/Asset";
import { Interval } from "../base/Interval";
import { OHLC } from "../base/Fields";
import { AWave } from "../base/Wavelets";
import { DSignal } from "../infra/signals/DSignal";
import { TSignal } from "../infra/signals/TSignal";
import { Wavelet } from "../infra/Wavelet";
import { DSignal_C } from "./DSignal_C";
import { DSignal_H } from "./DSignal_H";
import { DSignal_L } from "./DSignal_L";
import { DSignal_O } from "./DSignal_O";

export class AOHLCWave<A extends AssetPair> extends AWave<A, OHLC> {}

/* eslint-disable @typescript-eslint/no-explicit-any */

export class DSignal_OHLC<A extends AssetPair, I extends Interval> extends DSignal<number, OHLC, I> {

  constructor(interval: I, source: TSignal<any, number>, window: number) {
    super(
      interval,
      new DSignal_O(interval, source, window),
      new DSignal_H(interval, source, window),
      new DSignal_L(interval, source, window),
      new DSignal_C(interval, source)
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