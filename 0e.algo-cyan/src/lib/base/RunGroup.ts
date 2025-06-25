import { Run } from './Run';

export class RunGroup {
  private runs: Run[];
  private maxNetCapitalExposure: number = 0;

  constructor() {
    this.runs = [];
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

  start(): void {
    this.runs.forEach(run => run.start());
  }

  stop(): void {
    this.runs.forEach(run => run.stop());
  }
} 