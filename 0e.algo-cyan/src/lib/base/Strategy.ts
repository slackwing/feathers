import { AssetPair } from "./Asset";
import { VirtualExchange } from "./VirtualExchange";

export abstract class Strategy<A extends AssetPair> {
  readonly assetPair: A;
  readonly world: VirtualExchange<A>;
  constructor(assetPair: A, world: VirtualExchange<A>) {
    this.assetPair = assetPair;
    this.world = world;
  }

  public abstract start(): void;

  public abstract stop (): void;
}