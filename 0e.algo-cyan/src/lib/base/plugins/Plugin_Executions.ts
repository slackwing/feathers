import { Plugin, PluginBase } from '../Plugins';
import { World } from '../World';
import { Agent } from '../Agent';
import { Run } from '../Run';
import { PluginInstance } from '../Plugins';
import { OrderStatus } from '../Order';
import { PaperExchange } from '../../derived/PaperExchange';

export class Plugin_Executions implements Plugin {
  make(): PluginInstance_Executions {
    return new PluginInstance_Executions();
  }
} 

export class PluginInstance_Executions extends PluginBase {
  private orderSummaries: string[] = [];
  private unsubscribers: (() => void)[] = [];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRunStart(world: World, agents: Agent[], plugins: PluginInstance[]): void {
    this.orderSummaries = [];
    
    // Subscribe to execution feeds from all exchanges
    world.exchanges.forEach(exchange => {
      if (exchange instanceof PaperExchange) {
        const unsubscriber = exchange.executionFeed.subscribe((execution) => {
          // Check if this execution involves any of our agents' accounts
          const isRelevant = agents.some(agent => 
            agent.firm && 
            (execution.buyOrder.account === agent.firm.primaryAccount || 
             execution.sellOrder.account === agent.firm.primaryAccount)
          );
          
          if (isRelevant) {
            if (execution.buyOrder.account === execution.buyOrder.account && 
                (execution.buyOrder.status === OrderStatus.FILLED || execution.buyOrder.status === OrderStatus.CANCELLED)) {
              this.orderSummaries.push(`BUY ${execution.buyOrder.filled_qty.toFixed(2)} BTC @ ${execution.buyOrder.price.toFixed(2)} USD`);
            } else if (execution.sellOrder.account === execution.sellOrder.account && 
                       (execution.sellOrder.status === OrderStatus.FILLED || execution.sellOrder.status === OrderStatus.CANCELLED)) {
              this.orderSummaries.push(`SELL ${execution.sellOrder.filled_qty.toFixed(2)} BTC @ ${execution.sellOrder.price.toFixed(2)} USD`);
            }
          }
        });
        this.unsubscribers.push(unsubscriber);
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRunEnd(_world: World, _agents: Agent[], plugins: PluginInstance[]): void {
    // Clean up subscriptions
    this.unsubscribers.forEach(unsubscriber => unsubscriber());
    this.unsubscribers = [];
  }

  renderRunPanel(): React.ReactNode {
    if (this.orderSummaries.length === 0) {
      return "No executions";
    }
    return `Executions: ${this.orderSummaries.join(', ')}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  renderGroupPanel(_runs: Run[]): React.ReactNode {
    return null; // Only show in Run panel
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  renderOverallPanel(_allRuns: Run[]): React.ReactNode {
    return null; // Only show in Run panel
  }
} 