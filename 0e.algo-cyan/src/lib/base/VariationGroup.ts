import { Run } from './Run';
import { Quotes } from './Quotes';
import { IntelligenceV1 } from './Intelligence';
import { ReadOnlyPubSub } from '../infra/PubSub';
import { VariationParams } from './Variations';

export class VariationGroup {
  private runs: Run[] = [];
  private params: VariationParams;

  constructor(params: VariationParams) {
    this.params = params;
  }

  addRun(run: Run): void {
    this.runs.push(run);
  }

  getRuns(): Run[] {
    return [...this.runs];
  }

  getRunCount(): number {
    return this.runs.length;
  }

  getParams(): VariationParams {
    return this.params;
  }

  getIntelligenceFeeds(): ReadOnlyPubSub<IntelligenceV1>[] {
    return this.runs
      .map(run => run.intelligenceFeed)
      .filter((feed): feed is ReadOnlyPubSub<IntelligenceV1> => feed !== null);
  }

  getAverageMaxNetCapitalExposure(): number {
    if (this.runs.length === 0) return 0;
    const totalExposure = this.runs.reduce((sum, run) => sum + run.maxNetCapitalExposure, 0);
    return totalExposure / this.runs.length;
  }

  getAverageDeltaAccountValue(quotes: Quotes): number {
    if (this.runs.length === 0) return 0;
    const totalDelta = this.runs.reduce((sum, run) => {
      return sum + (run.paperAccount.computeTotalValue(quotes) - run.initialValue);
    }, 0);
    return totalDelta / this.runs.length;
  }

  getAverageSignalCount(): number {
    if (this.runs.length === 0) return 0;
    const totalSignals = this.runs.reduce((sum, run) => sum + run.getSignalCount(), 0);
    return totalSignals / this.runs.length;
  }

  getAverageTimeBetweenSignals(): number {
    if (this.runs.length === 0) return 0;
    const totalTime = this.runs.reduce((sum, run) => sum + run.getAverageTimeBetweenSignals(), 0);
    return totalTime / this.runs.length;
  }

  getAverageOversignalRatio(): number {
    if (this.runs.length === 0) return 0;
    const totalRatio = this.runs.reduce((sum, run) => sum + run.getOversignalRatio(), 0);
    return totalRatio / this.runs.length;
  }

  getStdDeviationSignalCount(): number {
    if (this.runs.length === 0) return 0;
    const mean = this.getAverageSignalCount();
    const variance = this.runs.reduce((acc, run) => {
      const signalCount = run.getSignalCount();
      return acc + Math.pow(signalCount - mean, 2);
    }, 0) / this.runs.length;
    return Math.sqrt(variance);
  }
} 