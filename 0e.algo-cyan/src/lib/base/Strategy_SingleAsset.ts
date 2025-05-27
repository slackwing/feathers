import { AssetPair } from "./Asset";
import { SingleAssetWorld } from "./World_SingleAsset";

export class SingleAssetStrategy<A extends AssetPair> {
  readonly assetPair: A;
  readonly world: SingleAssetWorld<A>;
  constructor(assetPair: A, world: SingleAssetWorld<A>) {
    this.assetPair = assetPair;
    this.world = world;
  }

  public start(): void {
    throw new Error("Not implemented");
  }
}