import { AssetPair } from "./Asset";
import { World_SingleAsset } from "./World_SingleAsset";

export class Strategy_SingleAsset<A extends AssetPair> {
  readonly assetPair: A;
  readonly world: World_SingleAsset<A>;
  constructor(assetPair: A, world: World_SingleAsset<A>) {
    this.assetPair = assetPair;
    this.world = world;
  }

  public start(): void {
    throw new Error("Not implemented");
  }
}