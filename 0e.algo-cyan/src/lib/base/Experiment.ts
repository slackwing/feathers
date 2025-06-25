import { ReadOnlyPubSub } from '../infra/PubSub';
import { IntelligenceV1 } from './Intelligence';
import { Variations } from './Variations';
import { Run } from './Run';
import { RunGroup } from './RunGroup';
import { VariationGroup } from './VariationGroup';
import { DSignalTAdapter_Clock } from '../infra/signals/DSignal';
import { World, WorldMaker } from './World';
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
  private readonly _variations: Variations;
  private readonly _config: ExperimentConfig;
  private readonly _plugins: Plugin[];

  private _runCount: number = 0;

  private runGroups: RunGroup[] = [];
  private variationGroups: VariationGroup[] = [];
  private currentRunGroup: RunGroup | null = null;
  
  private nextUpdateAt: number | null = null;
  private endExperimentAt: number | null = null;
  private startExperimentAt: number | null = null;
  private experimentRunning: boolean = false;

  constructor(
    clock: DSignalTAdapter_Clock<number, any>,
    worldMaker: WorldMaker<W>,
    variations: Variations,
    config: ExperimentConfig,
    plugins: Plugin[] = [],
  ) {
    this._clock = clock;
    this._worldMaker = worldMaker;
    this._variations = variations;
    this._config = config;
    this._plugins = plugins;
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
    
    const runGroup = new RunGroup();
    this._variations.forEach((variation, index) => {
      const world = this._worldMaker.make(variation);
      const plugins = this._plugins.map(maker => maker.make());
      const run = new Run(
        variation,
        world,
        plugins
      );
      runGroup.addRun(run);
      this.variationGroups[index].addRun(run);
    });

    this.runGroups.push(runGroup);
    runGroup.start();
    this.currentRunGroup = runGroup;
  }

  private updateCurrentRunResults(): void {
    if (!this.currentRunGroup) return;
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

  isRunning(): boolean {
    return this.experimentRunning;
  }

  getIntelligenceFeeds(): ReadOnlyPubSub<IntelligenceV1>[] {
    return this.variationGroups.flatMap(group => group.getIntelligenceFeeds());
  }
}