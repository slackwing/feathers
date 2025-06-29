import { Plugin, PluginBase } from '../Plugins';
import { World } from '../World';
import { Run } from '../Run';
import { PluginInstance } from '../Plugins';
import { IntelligenceV1, IntelligenceV1Type } from '../Intelligence';

interface SignalData {
  lastSignalTime: number;
  timeBetweenSignals: number[];
  intelCounts: Map<IntelligenceV1Type, number>;
}

export class Plugin_Signals implements Plugin {
  make(): PluginInstance_Signals {
    return new PluginInstance_Signals();
  }
} 

export class PluginInstance_Signals extends PluginBase {
  private signalDataByAgent: Map<string, SignalData> = new Map();
  private unsubscribers: (() => void)[] = [];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRunStart(world: World, plugins: readonly PluginInstance[]): void {
    this.signalDataByAgent.clear();
    
    // Subscribe to all agents' intelligence feeds
    world.getAgents().forEach(agent => {
      const signalData: SignalData = {
        lastSignalTime: 0,
        timeBetweenSignals: [],
        intelCounts: new Map()
      };
      
      this.signalDataByAgent.set(agent.id, signalData);
      
      const unsubscriber = agent.intelFeed.subscribe((intel: IntelligenceV1) => {
        signalData.intelCounts.set(intel.type, (signalData.intelCounts.get(intel.type) || 0) + 1);
        if (intel.type === IntelligenceV1Type.SIGNAL) {
          const now = Date.now();
          if (signalData.lastSignalTime !== 0) {
            signalData.timeBetweenSignals.push(now - signalData.lastSignalTime);
          }
          signalData.lastSignalTime = now;
        }
      });
      
      this.unsubscribers.push(unsubscriber);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRunEnd(_world: World, plugins: readonly PluginInstance[]): void {
    // Clean up subscriptions
    this.unsubscribers.forEach(unsubscriber => unsubscriber());
    this.unsubscribers = [];
  }

  renderRunPanel(): React.ReactNode {
    // Aggregate data across all agents
    let totalSignalCount = 0;
    let totalOversignalCount = 0;
    let totalPresignalCount = 0;
    const allTimeBetweenSignals: number[] = [];
    
    this.signalDataByAgent.forEach((data) => {
      const signalCount = data.intelCounts.get(IntelligenceV1Type.SIGNAL) || 0;
      const oversignalCount = data.intelCounts.get(IntelligenceV1Type.OVERSIGNAL) || 0;
      const presignalCount = data.intelCounts.get(IntelligenceV1Type.PRESIGNAL) || 0;
      
      totalSignalCount += signalCount;
      totalOversignalCount += oversignalCount;
      totalPresignalCount += presignalCount;
      allTimeBetweenSignals.push(...data.timeBetweenSignals);
    });
    
    const avgTimeBetweenSignals = allTimeBetweenSignals.length > 0 
      ? allTimeBetweenSignals.reduce((a, b) => a + b, 0) / allTimeBetweenSignals.length 
      : 0;
    
    const oversignalRatio = totalSignalCount > 0 ? totalOversignalCount / totalSignalCount : 0;
    
    return `Signals=${totalSignalCount}, Oversignals=${totalOversignalCount}, Presignals=${totalPresignalCount}, AvgTime=${avgTimeBetweenSignals.toFixed(0)}ms, OversignalRatio=${oversignalRatio.toFixed(2)}`;
  }

  renderGroupPanel(runs: Run[]): React.ReactNode {
    const allSignalCounts: number[] = [];
    const allOversignalRatios: number[] = [];
    
    runs.forEach(run => {
      const plugin = run.getPlugin(PluginInstance_Signals);
      if (plugin) {
        plugin.signalDataByAgent.forEach(data => {
          const signalCount = data.intelCounts.get(IntelligenceV1Type.SIGNAL) || 0;
          const oversignalCount = data.intelCounts.get(IntelligenceV1Type.OVERSIGNAL) || 0;
          allSignalCounts.push(signalCount);
          allOversignalRatios.push(signalCount > 0 ? oversignalCount / signalCount : 0);
        });
      }
    });
    
    const totalSignals = allSignalCounts.reduce((a, b) => a + b, 0);
    const avgOversignalRatio = allOversignalRatios.length > 0 
      ? allOversignalRatios.reduce((a, b) => a + b, 0) / allOversignalRatios.length 
      : 0;
    
    return `Total Signals: ${totalSignals}, Avg Oversignal Ratio: ${avgOversignalRatio.toFixed(2)}`;
  }

  renderOverallPanel(allRuns: Run[]): React.ReactNode {
    const allSignalCounts: number[] = [];
    const allOversignalRatios: number[] = [];
    
    allRuns.forEach(run => {
      const plugin = run.getPlugin(PluginInstance_Signals);
      if (plugin) {
        plugin.signalDataByAgent.forEach(data => {
          const signalCount = data.intelCounts.get(IntelligenceV1Type.SIGNAL) || 0;
          const oversignalCount = data.intelCounts.get(IntelligenceV1Type.OVERSIGNAL) || 0;
          allSignalCounts.push(signalCount);
          allOversignalRatios.push(signalCount > 0 ? oversignalCount / signalCount : 0);
        });
      }
    });
    
    const totalSignals = allSignalCounts.reduce((a, b) => a + b, 0);
    const avgOversignalRatio = allOversignalRatios.length > 0 
      ? allOversignalRatios.reduce((a, b) => a + b, 0) / allOversignalRatios.length 
      : 0;
    
    return `Total Signals: ${totalSignals}, Avg Oversignal Ratio: ${avgOversignalRatio.toFixed(2)}`;
  }
} 