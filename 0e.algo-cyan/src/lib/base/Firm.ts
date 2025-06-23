import { generateId } from "../utils/id";
import { Account } from "./Account";
import { Agent } from "./Agent";

export class Firm {
  public readonly id: string;
  private readonly _name: string | null;
  protected readonly _accounts: Set<Account>;
  protected readonly _agents: Set<Agent>;

  constructor(name?: string) {
    this.id = generateId('FIRM');
    this._name = name ?? null;
    this._accounts = new Set();
    this._agents = new Set();
  }

  public get name(): string { return this._name ?? this.id; }

  public addAccount(account: Account): void {
    this._accounts.add(account);
  }

  public addAgent(agent: Agent): void {
    this._agents.add(agent);
    agent.firm = this;
  }

  public get primaryAccount(): Account {
    if (this._accounts.size === 0) {
      throw new Error(`Firm ${this.name} has no accounts`);
    }
    return Array.from(this._accounts)[0];
  }
}