import { Run } from './Run';
import { Quotes } from './Quotes';
import { IntelligenceV1 } from './Intelligence';
import { ReadOnlyPubSub } from '../infra/PubSub';

export class RunGroup {
  private runs: Run[];
  private maxNetCapitalExposure: number = 0;

  constructor(runs: Run[]) {
    this.runs = runs;
    this.calculateMaxNetCapitalExposure();
  }

  private calculateMaxNetCapitalExposure(): void {
    this.maxNetCapitalExposure = Math.max(
      ...this.runs.map(run => run.maxNetCapitalExposure)
    );
  }

  getRuns(): Run[] {
    return [...this.runs];
  }

  getRunCount(): number {
    return this.runs.length;
  }

  getMaxNetCapitalExposure(): number {
    return this.maxNetCapitalExposure;
  }

  getIntelligenceFeeds(): ReadOnlyPubSub<IntelligenceV1>[] {
    return this.runs
      .map(run => run.intelligenceFeed)
      .filter((feed): feed is ReadOnlyPubSub<IntelligenceV1> => feed !== null);
  }

  start(): void {
    this.runs.forEach(run => run.start());
  }

  stop(): void {
    this.runs.forEach(run => run.stop());
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
} 