import { Variation } from './Variations';
import { World } from './World';
import { Agent } from './Agent';
import { PluginInstance } from './Plugins';
import { Firm } from './Firm';

export class Run {

  public readonly variation: Variation;
  public readonly world: World;
  public readonly firms: ReadonlySet<Firm>;
  public readonly agents: ReadonlySet<Agent>;
  public readonly plugins: readonly PluginInstance[];

  constructor(
    variation: Variation,
    world: World,
    plugins: PluginInstance[] = []
  ) {
    this.variation = variation;
    this.world = world;
    this.firms = world.getFirms();
    this.agents = new Set<Agent>(Array.from(this.firms).flatMap(firm => Array.from(firm.getAgents())));
    this.plugins = plugins;
    this.plugins.forEach((plugin, index) => plugin.registerIndex(index));
  }

  start(): void {
    this.plugins.forEach(plugin => plugin.onRunStart(this.world, this.plugins));
    this.agents.forEach(agent => agent.wake());
  }

  stop(): void {
    this.agents.forEach(agent => agent.sleep());
    this.plugins.forEach(plugin => plugin.onRunEnd(this.world, this.plugins));
  }

  getPlugin<T extends PluginInstance>(pluginClass: new (...args: unknown[]) => T): T | undefined {
    return this.plugins.find(plugin => plugin instanceof pluginClass) as T | undefined;
  }
} 