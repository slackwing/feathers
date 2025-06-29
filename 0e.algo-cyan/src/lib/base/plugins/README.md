# Run Plugin System

The plugin system allows you to add monitoring and display capabilities to experiments without modifying the core Run class.

## Usage

### Creating an Experiment with Plugins

```typescript
import { Experiment } from '../Experiment';
import { 
  PluginMaker_MaxNetCapitalExposure, 
  PluginMaker_Executions, 
  PluginMaker_Signals 
} from './plugins';

// Create plugin makers
const pluginMakers = [
  new Plugin_MaxNetCapitalExposure(),
  new Plugin_Executions(),
  new Plugin_Signals()
];

// Create experiment with plugin makers
const experiment = new Experiment(
  clock,
  worldMaker,
  agentMakers,
  variations,
  config,
  pluginMakers
);
```

### Available Plugins

#### Plugin_MaxNetCapitalExposure
- **Purpose**: Tracks the maximum net capital exposure across all agents' accounts
- **Displays**: Shows in Run, Run Group, and Overall panels
- **Data**: Monitors transaction feeds from all agents' firms' primary accounts

#### Plugin_Executions
- **Purpose**: Tracks buy/sell order executions
- **Displays**: Shows only in Run panel
- **Data**: Monitors execution feeds from all paper exchanges

#### Plugin_Signals
- **Purpose**: Tracks intelligence signals from agents
- **Displays**: Shows in Run, Run Group, and Overall panels
- **Data**: Monitors intelligence feeds from all agents

### Creating Custom Plugins

To create a custom plugin, extend the `BaseRunPlugin` class and create a corresponding maker:

```typescript
import { BaseRunPlugin } from '../RunPlugin';
import { PluginMaker } from '../RunPlugin';
import { World } from '../World';
import { Agent } from '../Agent';
import { Run } from '../Run';
import { RunPlugin } from '../RunPlugin';

export class MyCustomPlugin extends BaseRunPlugin {
  private myData: any = null;
  private unsubscribers: (() => void)[] = [];

  onRunStart(world: World, agents: Agent[], plugins: RunPlugin[]): void {
    // Set up subscriptions and initialize data
    // Store unsubscribe functions for cleanup
  }

  onRunEnd(world: World, agents: Agent[], plugins: RunPlugin[]): void {
    // Clean up subscriptions
    this.unsubscribers.forEach(unsubscriber => unsubscriber());
    this.unsubscribers = [];
  }

  renderRunPanel(): React.ReactNode {
    // Return what to display in the Run panel
    return "My custom data";
  }

  renderRunGroupPanel(runs: Run[]): React.ReactNode {
    // Return what to display in the Run Group panel
    return "Aggregated data";
  }

  renderOverallPanel(allRuns: Run[]): React.ReactNode {
    // Return what to display in the Overall panel
    return "Overall data";
  }
}

export class MyCustomPlugin implements Plugin {
  make(): MyCustomPlugin {
    return new MyCustomPlugin();
  }
}
```

## Plugin Lifecycle

1. **onRunStart**: Called when a run starts, before agents are woken
2. **onRunEnd**: Called when a run ends, after agents are put to sleep
3. **render*Panel**: Called when UI needs to display plugin data

## Architecture Benefits

- **Fresh Instances**: Each run gets its own plugin instance, preventing data contamination
- **Data Persistence**: Plugin data persists across runs for aggregation in Run Group and Overall panels
- **Factory Pattern**: Follows the same pattern as WorldMaker and AgentMaker for consistency
- **Memory Management**: Each plugin instance manages its own subscriptions and cleanup

## Best Practices

- Always clean up subscriptions in `onRunEnd`
- Store unsubscribe functions returned from subscriptions
- Use the `getPlugin()` method on Run instances to access other plugins' data
- Return `null` from render methods if you don't want to display anything in that panel 