import { Run } from './Run';
import { Variation } from './Variations';

export class VariationGroup {
  private runs: Run[] = [];
  private variation: Variation;

  constructor(variation: Variation) {
    this.variation = variation;
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

  getVariation(): Variation {
    return this.variation;
  }
} 