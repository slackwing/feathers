import { AssetPair } from "./Asset";
import { SingleAssetWorld } from "./World_SingleAsset";

export class SingleAssetStrategy<T extends AssetPair> {
  readonly assetPair: T;
  readonly world: SingleAssetWorld<T>;
  constructor(assetPair: T, world: SingleAssetWorld<T>) {
    this.assetPair = assetPair;
    this.world = world;
  }

  public start(): void {
    throw new Error("Not implemented");
  }
}