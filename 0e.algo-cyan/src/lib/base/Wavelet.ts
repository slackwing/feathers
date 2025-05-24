import { AssetPair } from "./Asset";
import { OHLC } from "./OHLC";
import { Timestamped } from "./Timestamped";

/**
 * A wavelet is meant to invoke the image of a packet of data in a signal. Our
 * data is a number with a timestamp, which we happen to type by asset pair for
 * programming safety.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export class Wavelet<A extends AssetPair, T> implements Timestamped {
  constructor(public readonly value: T, public readonly timestamp: number) {}
}

export class NWave<A extends AssetPair> extends Wavelet<A, number> {}
export class OHLCWave<A extends AssetPair> extends Wavelet<A, OHLC> {}