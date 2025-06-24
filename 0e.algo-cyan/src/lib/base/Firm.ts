import { generateId } from "../utils/id";
import { Account } from "./Account";
import { Agent } from "./Agent";
import { Variation } from "./Variations";
import { World } from "./World";

export class Firm {
  public readonly id: string;
  public readonly world: World;
  private readonly _name: string | null;
  private readonly _accounts: Set<Account>;
  private readonly _agents: Set<Agent>;

  constructor(world: World, name?: string) {
    this.id = generateId('FIRM');
    this.world = world;
    this._name = name ?? null;
    this._accounts = new Set();
    this._agents = new Set();
  }

  public get name(): string { return this._name ?? this.id; }

  public addAccount(account: Account): void {
    this._accounts.add(account);
  }

  public getAccounts(): ReadonlySet<Account> {
    return this._accounts;
  }

  public addAgent(agent: Agent): void {
    this._agents.add(agent);
    agent.firm = this;
  }

  public getAgents(): ReadonlySet<Agent> {
    return this._agents;
  }

  public get primaryAccount(): Account {
    if (this._accounts.size === 0) {
      throw new Error(`Firm ${this.name} has no accounts`);
    }
    return Array.from(this._accounts)[0];
  }
}

export interface FirmMaker {
  make(world: World, variation: Variation): Firm;
}