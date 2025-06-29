import { PubSub, ReadOnlyPubSub } from "../infra/PubSub";
import { generateId } from "../utils/id";
import { Firm } from "./Firm";
import { IntelligenceV1 } from "./Intelligence";
import { Variation } from "./Variations";
import { World } from "./World";

export abstract class Agent {
  public readonly id: string;
  public readonly world: World;
  // TODO(P2): Inconsistent; Agent can belong to multiple firms.
  public firm: Firm | null = null;
  private readonly _name: string | null;
  private _resourcesProcured: boolean;
  private _awake: boolean;

  protected readonly _intelFeed: PubSub<IntelligenceV1> = new PubSub<IntelligenceV1>();

  public constructor(world: World, name?: string) {
    this.id = generateId('AGENT');
    this.world = world;
    this._name = name ?? null;
    this._resourcesProcured = false;
    this._awake = false;
  }

  public get name(): string { return this._name ?? this.id; }
  public get intelFeed(): ReadOnlyPubSub<IntelligenceV1> { return this._intelFeed; }

  public abstract procureResources(): void;

  public wake(): void {
    if (!this._resourcesProcured) {
      try {
        this.procureResources();
        this._resourcesProcured = true;
      } catch (error) {
        console.error(`Agent ${this.name} failed to procure resources: ${error}`);
      }
    }
    this._awake = true;
    this.onWake();
  }

  public abstract onWake(): void;

  public sleep(): void {
    if (this._awake) {
      this.onSleep();
      this._awake = false;
    }
  }

  public abstract onSleep(): void;
}

export interface AgentMaker {
  make(world: World, variation: Variation): Agent;
}