import { Variation } from './Variations';
import { World } from './World';
import { Agent } from './Agent';
import { PluginInstance } from './Plugins';

export class Run {

  public readonly variation: Variation;
  public readonly world: World;
  public readonly agents: Agent[];
  public readonly plugins: PluginInstance[];

  constructor(
    variation: Variation,
    world: World,
    agents: Agent[],
    plugins: PluginInstance[] = []
  ) {
    this.variation = variation;
    this.world = world;
    this.agents = agents;
    this.plugins = plugins;
  }

  start(): void {
    this.plugins.forEach(plugin => plugin.onRunStart(this.world, this.agents, this.plugins));
    this.agents.forEach(agent => agent.wake());
  }

  stop(): void {
    this.agents.forEach(agent => agent.sleep());
    this.plugins.forEach(plugin => plugin.onRunEnd(this.world, this.agents, this.plugins));
  }

  getPlugin<T extends PluginInstance>(pluginClass: new (...args: unknown[]) => T): T | undefined {
    return this.plugins.find(plugin => plugin instanceof pluginClass) as T | undefined;
  }
} 