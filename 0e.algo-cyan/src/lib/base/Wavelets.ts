import { Wavelet } from "../infra/Wavelet";
import { AssetPair } from "./Asset";

/**
 * A wavelet is meant to invoke the image of a packet of data in a signal. Our
 * data is a number with a timestamp, which we happen to type by asset pair for
 * programming safety.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export class AWave<A extends AssetPair, T> extends Wavelet<T> {
  constructor(public readonly value: T, public readonly timestamp: number) {
    super(value, timestamp);
  }
}

export class ANWave<A extends AssetPair> extends AWave<A, number> {}