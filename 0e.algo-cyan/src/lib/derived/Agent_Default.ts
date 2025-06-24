import { Agent } from "../base/Agent";
import { AssetPair } from "../base/Asset";
import { Firm } from "../base/Firm";
import { World } from "../base/World";
import { PaperExchange } from "./PaperExchange";

export abstract class Agent_Default<A extends AssetPair> extends Agent {

  public readonly assetPair: A;
  protected _exchange: PaperExchange<A> | null = null;
  protected _firm: Firm | null = null;

  constructor(
    assetPair: A,
    world: World,
    name?: string,
  ) {
    super(world, name);
    this.assetPair = assetPair;
  }

  public procureResources(): void {
    const exchanges = this.world.exchangesByAssetPair.get(this.assetPair);
    if (exchanges) {
      for (const exchange of exchanges) {
        if (exchange instanceof PaperExchange) {
          this._exchange = exchange;
          break;
        }
      }
    }
    if (!this._exchange) {
      throw new Error(`Paper exchange for asset pair ${this.assetPair} not found`);
    }
    if (!this._firm) {
      throw new Error(`Firm not found`);
    }
  }
}