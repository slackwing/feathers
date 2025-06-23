import { AssetPair } from "../base/Asset";
import { Interval } from "../base/Interval";
import { World } from "../base/World";

export class World_Singular<A extends AssetPair, I extends Interval> extends World {
  
  public readonly assetPair: A;
  public readonly interval: I; // TODO(P2): Is this needed?
  
  constructor(
    assetPair: A,
    interval: I,
  ) {
    super();
    this.assetPair = assetPair;
    this.interval = interval;
  }
}