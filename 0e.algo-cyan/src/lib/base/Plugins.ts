import { World } from './World';
import { Run } from './Run';

export interface Plugin {
  make(): PluginInstance;
} 

export interface PluginInstance {
  // Used for quick access to the plugin across runs.
  registerIndex(index: number): void;
  onRunStart(world: World, plugins: readonly PluginInstance[]): void;
  onRunEnd(world: World, plugins: readonly PluginInstance[]): void;
  renderRunPanel(): React.ReactNode;
  renderGroupPanel(runs: Run[]): React.ReactNode;
  renderOverallPanel(allRuns: Run[]): React.ReactNode;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export abstract class PluginBase implements PluginInstance {
  public pluginIndex: number = -1;
  registerIndex(index: number): void {
    this.pluginIndex = index;
  }
  abstract onRunStart(world: World, plugins: readonly PluginInstance[]): void;
  abstract onRunEnd(world: World, plugins: readonly PluginInstance[]): void;
  renderRunPanel(): React.ReactNode { return null; }
  renderGroupPanel(runs: Run[]): React.ReactNode { return null; }
  renderOverallPanel(allRuns: Run[]): React.ReactNode { return null; }
}