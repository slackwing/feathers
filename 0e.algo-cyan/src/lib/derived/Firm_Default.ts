import { Firm, FirmMaker } from "../base/Firm";
import { World } from "../base/World";
import { AgentMaker } from "../base/Agent";
import { Variation } from "../base/Variations";

export class Firm_Default extends Firm {
  constructor(world: World, name?: string) {
    super(world, name);
  }
}

export class FirmMaker_Default implements FirmMaker {

  private readonly _agentMakers: AgentMaker[];

  constructor(agentMakers: AgentMaker[]) {
    this._agentMakers = agentMakers;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  make(world: World, variation: Variation): Firm_Default {
    const firm = new Firm_Default(world);
    this._agentMakers.forEach(agentMaker => {
      firm.addAgent(agentMaker.make(world, variation));
    });
    return firm;
  }
}