import { Plugin, PluginBase } from '../Plugins';
import { World } from '../World';
import { Run } from '../Run';
import { PluginInstance } from '../Plugins';
import { PaperExchange } from '../../derived/PaperExchange';

export class Plugin_AccountValue implements Plugin {
  make(): PluginInstance_AccountValue {
    return new PluginInstance_AccountValue();
  }
} 

export class PluginInstance_AccountValue extends PluginBase {
  private initialValue: number = 0;
  private finalValue: number = 0;
  private unsubscribers: (() => void)[] = [];

  private computeTotalValue(world: World): number {
    if (world.quotes) {
      let totalValue = 0;
      world.firms.forEach(firm => {
        totalValue += firm.primaryAccount.computeTotalValue(world.quotes!);
      });
      return totalValue;
    }
    return 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRunStart(world: World, plugins: readonly PluginInstance[]): void {
    this.initialValue = this.computeTotalValue(world);
    this.finalValue = this.initialValue;

    world.exchanges.forEach(exchange => {
      if (exchange instanceof PaperExchange) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const unsubscriber = exchange.executionFeed.subscribe((execution) => {
          // TODO(POpt): Can update more selectively using execution data.
          this.computeTotalValue(world);
        });
        this.unsubscribers.push(unsubscriber);
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRunEnd(world: World, plugins: readonly PluginInstance[]): void {
    // Calculate final value one more time
    this.finalValue = this.computeTotalValue(world);
    
    // Clean up subscriptions
    this.unsubscribers.forEach(unsubscriber => unsubscriber());
    this.unsubscribers = [];
  }

  renderRunPanel(): React.ReactNode {
    const delta = this.finalValue - this.initialValue;
    const deltaPercent = this.initialValue > 0 ? (delta / this.initialValue) * 100 : 0;
    return `Initial: $${this.initialValue.toFixed(2)}, Final: $${this.finalValue.toFixed(2)}, Delta: $${delta.toFixed(2)} (${deltaPercent.toFixed(2)}%)`;
  }

  renderGroupPanel(runs: Run[]): React.ReactNode {
    let totalInitialValue = 0;
    let totalFinalValue = 0;
    
    runs.forEach(run => {
      const plugin = run.getPlugin(PluginInstance_AccountValue);
      if (plugin) {
        totalInitialValue += plugin.initialValue;
        totalFinalValue += plugin.finalValue;
      }
    });
    
    const totalDelta = totalFinalValue - totalInitialValue;
    const totalDeltaPercent = totalInitialValue > 0 ? (totalDelta / totalInitialValue) * 100 : 0;
    
    return `Total Initial: $${totalInitialValue.toFixed(2)}, Total Final: $${totalFinalValue.toFixed(2)}, Total Delta: $${totalDelta.toFixed(2)} (${totalDeltaPercent.toFixed(2)}%)`;
  }

  renderOverallPanel(allRuns: Run[]): React.ReactNode {
    let totalInitialValue = 0;
    let totalFinalValue = 0;
    
    allRuns.forEach(run => {
      const plugin = run.getPlugin(PluginInstance_AccountValue);
      if (plugin) {
        totalInitialValue += plugin.initialValue;
        totalFinalValue += plugin.finalValue;
      }
    });
    
    const totalDelta = totalFinalValue - totalInitialValue;
    const totalDeltaPercent = totalInitialValue > 0 ? (totalDelta / totalInitialValue) * 100 : 0;
    
    return `Overall Initial: $${totalInitialValue.toFixed(2)}, Overall Final: $${totalFinalValue.toFixed(2)}, Overall Delta: $${totalDelta.toFixed(2)} (${totalDeltaPercent.toFixed(2)}%)`;
  }
} 