import { Plugin, PluginBase } from '../Plugins';
import { World } from '../World';
import { Agent } from '../Agent';
import { Run } from '../Run';
import { PluginInstance } from '../Plugins';

export class Plugin_MaxNetCapitalExposure implements Plugin {
  make(): PluginInstance_MaxNetCapitalExposure {
    return new PluginInstance_MaxNetCapitalExposure();
  }
} 

export class PluginInstance_MaxNetCapitalExposure extends PluginBase {
  private netCapitalExposure: number = 0;
  private maxNetCapitalExposure: number = 0;
  private unsubscribers: (() => void)[] = [];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRunStart(world: World, agents: Agent[], plugins: PluginInstance[]): void {
    this.netCapitalExposure = 0;
    this.maxNetCapitalExposure = 0;
    
    agents.forEach(agent => {
      if (!agent.firm) {
        console.warn(`WARNING: Agent ${agent.name} has no firm, skipping.`);
      } else {
        const unsubscriber = agent.firm.primaryAccount.getTransactionsFeed().subscribe((fundLog) => {
          if (fundLog.amount > 0 && world.quotes) {
            if (fundLog.asset === world.quotes.quotingAsset) {
              // The direction doesn't matter because in the end it's the absolute value.
              this.netCapitalExposure += fundLog.amount;
            } else {
              // The direction doesn't matter because in the end it's the absolute value.
              this.netCapitalExposure -= world.quotes.getQuote(fundLog.asset) * fundLog.amount;
            }
            this.maxNetCapitalExposure = Math.max(this.maxNetCapitalExposure, Math.abs(this.netCapitalExposure));
          }
        });
        this.unsubscribers.push(unsubscriber);
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRunEnd(_world: World, _agents: Agent[], plugins: PluginInstance[]): void {
    this.unsubscribers.forEach(unsubscriber => unsubscriber());
    this.unsubscribers = [];
  }

  renderRunPanel(): React.ReactNode {
    return `Max Net Capital Exposure: ${this.maxNetCapitalExposure.toFixed(2)}`;
  }

  renderGroupPanel(runs: Run[]): React.ReactNode {
    const maxExposure = Math.max(...runs.map(run => {
      const plugin = run.getPlugin(PluginInstance_MaxNetCapitalExposure);
      return plugin?.maxNetCapitalExposure || 0;
    }));
    return `Max Net Capital Exposure: ${maxExposure.toFixed(2)}`;
  }

  renderOverallPanel(allRuns: Run[]): React.ReactNode {
    const maxExposure = Math.max(...allRuns.map(run => {
      const plugin = run.getPlugin(PluginInstance_MaxNetCapitalExposure);
      return plugin?.maxNetCapitalExposure || 0;
    }));
    return `Max Net Capital Exposure: ${maxExposure.toFixed(2)}`;
  }
}