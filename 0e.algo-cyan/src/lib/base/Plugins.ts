import { World } from './World';
import { Agent } from './Agent';
import { Run } from './Run';

export interface Plugin {
  make(): PluginInstance;
} 

export interface PluginInstance {
  onRunStart(world: World, agents: Agent[], plugins: PluginInstance[]): void;
  onRunEnd(world: World, agents: Agent[], plugins: PluginInstance[]): void;
  
  // UI rendering methods
  renderRunPanel(): React.ReactNode;
  renderGroupPanel(runs: Run[]): React.ReactNode;
  renderOverallPanel(allRuns: Run[]): React.ReactNode;
}

export abstract class PluginBase implements PluginInstance {
  abstract onRunStart(world: World, agents: Agent[], plugins: PluginInstance[]): void;
  abstract onRunEnd(world: World, agents: Agent[], plugins: PluginInstance[]): void;
  
  renderRunPanel(): React.ReactNode {
    return null;
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  renderGroupPanel(runs: Run[]): React.ReactNode {
    return null;
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  renderOverallPanel(allRuns: Run[]): React.ReactNode {
    return null;
  }
}