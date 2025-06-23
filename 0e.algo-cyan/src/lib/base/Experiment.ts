import { AssetPair } from './Asset';
import { PubSub, ReadOnlyPubSub } from '../infra/PubSub';
import { IntelligenceV1 } from './Intelligence';
import { Variations } from './Variations';
import { Run } from './Run';
import { RunGroup } from './RunGroup';
import { VariationGroup } from './VariationGroup';
import { Account } from './Account';
import { Order } from './Order';
import { DSignalTAdapter_Clock } from '../infra/signals/DSignal';
import { World, WorldMaker } from './World';
import { AgentMaker } from './Agent';
import { Plugin } from './Plugins';

export interface ExperimentConfig {
  MAX_RUNS: number;
  INITIAL_DELAY_MS: number;
  RUN_DURATION_MS: number;
  COOLDOWN_MS: number;
  RENDER_RESULTS_EVERY_MS: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export class Experiment<W extends World> {

  private readonly _clock: DSignalTAdapter_Clock<number, any>;
  private readonly _worldMaker: WorldMaker<any>;
  private readonly _agentMakers: AgentMaker[];
  private readonly _variations: Variations;
  private readonly _config: ExperimentConfig;
  private readonly _pluginMakers: Plugin[];

  private _runCount: number = 0;

  private runGroups: RunGroup[] = [];
  private variationGroups: VariationGroup[] = [];
  private currentRunGroup: RunGroup | null = null;
  
  private maxNetCapitalExposure: number = 0;
  private nextUpdateAt: number | null = null;
  private endExperimentAt: number | null = null;
  private startExperimentAt: number | null = null;
  private experimentRunning: boolean = false;

  constructor(
    clock: DSignalTAdapter_Clock<number, any>,
    worldMaker: WorldMaker<W>,
    agentMakers: AgentMaker[],
    variations: Variations,
    config: ExperimentConfig,
    pluginMakers: Plugin[] = [],
  ) {
    this._clock = clock;
    this._worldMaker = worldMaker;
    this._agentMakers = agentMakers;
    this._variations = variations;
    this._config = config;
    this._pluginMakers = pluginMakers;
    this.setupClockListener();
  }

  private setupClockListener(): void {
    this._clock.listen((tick) => {
      if (this.startExperimentAt === null) {
        this.startExperimentAt = tick.timestamp + this._config.INITIAL_DELAY_MS;
      }

      if (this.experimentRunning && this.nextUpdateAt !== null && tick.timestamp >= this.nextUpdateAt) {
        this.nextUpdateAt = null;
        this.updateCurrentRunResults();
        this.nextUpdateAt = tick.timestamp + this._config.RENDER_RESULTS_EVERY_MS;
      }

      if (this.experimentRunning && this.endExperimentAt !== null && tick.timestamp >= this.endExperimentAt) {
        this.endCurrentRun();
      }

      if (!this.experimentRunning && this.startExperimentAt !== null && tick.timestamp >= this.startExperimentAt) {
        this.startNewRun();
      }
    });
  }

  private endCurrentRun(): void {
    if (!this.currentRunGroup) return;

    this.experimentRunning = false;
    this.endExperimentAt = null;
    this.nextUpdateAt = null;

    this.currentRunGroup.stop();
    
    this.updateCurrentRunResults();

    this._runCount++;
    if (this._runCount < this._config.MAX_RUNS) {
      this.startExperimentAt = Date.now() + this._config.COOLDOWN_MS;
    }
  }

  private startNewRun(): void {
    this.experimentRunning = true;
    this.startExperimentAt = null;
    this.endExperimentAt = Date.now() + this._config.RUN_DURATION_MS;
    this.nextUpdateAt = Date.now() + this._config.RENDER_RESULTS_EVERY_MS;
    this.createAndStartRunGroup();
  }

  private createAndStartRunGroup(): void {
    const runs: Run[] = [];

    // Create a Run for each variation
    this._variations.forEach((variation, index) => {

      const world = this._worldMaker.make(variation);
      const agents = this._agentMakers.map(maker => maker.make(world, variation));
      const plugins = this._pluginMakers.map(maker => maker.make());

      const run = new Run(
        variation,
        world,
        agents,
        plugins
      );

      runs.push(run);
      
      // Add to corresponding variation group
      this.variationGroups[index].addRun(run);
    });

    // Create and start the run group
    this.currentRunGroup = new RunGroup(runs);
    this.currentRunGroup.start();
    this.runGroups.push(this.currentRunGroup);
  }

  private updateCurrentRunResults(): void {
    if (!this.currentRunGroup) return;

    // Update max net capital exposure across all runs
    const groupMaxExposure = this.currentRunGroup.getMaxNetCapitalExposure();
    this.maxNetCapitalExposure = Math.max(this.maxNetCapitalExposure, groupMaxExposure);
  }

  // Public API methods
  getRunGroups(): RunGroup[] {
    return [...this.runGroups];
  }

  getVariationGroups(): VariationGroup[] {
    return [...this.variationGroups];
  }

  getCurrentRunGroup(): RunGroup | null {
    return this.currentRunGroup;
  }

  getRunCount(): number {
    return this._runCount;
  }

  getMaxNetCapitalExposure(): number {
    return this.maxNetCapitalExposure;
  }

  isRunning(): boolean {
    return this.experimentRunning;
  }

  getIntelligenceFeeds(): ReadOnlyPubSub<IntelligenceV1>[] {
    return this.variationGroups.flatMap(group => group.getIntelligenceFeeds());
  }
}