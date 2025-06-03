import React from 'react';
import styles from './ExperimentResultsDisplay.module.css';
import { RunResult } from '@/lib/base/RunResult';

export enum Mode {
  ABSOLUTE = 'ABSOLUTE',
  GLOBAL_ZERO_RELATIVE = 'GLOBAL_ZERO_RELATIVE',
  GLOBAL_RELATIVE = 'GLOBAL_RELATIVE',
  RUN_ZERO_RELATIVE = 'RUN_ZERO_RELATIVE',
  RUN_RELATIVE = 'RUN_RELATIVE'
}

interface ExperimentResultsDisplayProps {
  runResults: RunResult[];
  mode: Mode;
}

const ExperimentResultsDisplay: React.FC<ExperimentResultsDisplayProps> = ({ runResults, mode }) => {
  
  const getColor = (value: number, index: number) => {
    if (mode === Mode.GLOBAL_RELATIVE || mode === Mode.RUN_RELATIVE) {
      // For relative modes, use yellow to blue color scheme
      const runStartIndex = Math.floor(index / 16) * 16;
      const relevantResults = mode === Mode.GLOBAL_RELATIVE ? runResults : runResults.slice(runStartIndex, runStartIndex + 16);
      const minValue = Math.min(...relevantResults.map(r => r.deltaValue));
      const maxValue = Math.max(...relevantResults.map(r => r.deltaValue));
      const range = maxValue - minValue;
      
      if (range === 0) return 'rgb(192, 192, 192)'; // Gray for no range
      
      const normalizedValue = (value - minValue) / range;
      
      // Yellow (255, 255, 0) to Gray (192, 192, 192) to Blue (0, 0, 255)
      if (normalizedValue < 0.5) {
        const t = normalizedValue * 2;
        const red = Math.round(192 + (255 - 192) * (1 - t));
        const green = Math.round(192 + (255 - 192) * (1 - t));
        const blue = Math.round(192 * t);
        return `rgb(${red}, ${green}, ${blue})`;
      } else {
        const t = (normalizedValue - 0.5) * 2;
        const red = Math.round(192 * (1 - t));
        const green = Math.round(192 * (1 - t));
        const blue = Math.round(192 + (255 - 192) * t);
        return `rgb(${red}, ${green}, ${blue})`;
      }
    }

    const baseValue = mode === Mode.GLOBAL_ZERO_RELATIVE ? runResults[0].baseValueGlobal : runResults[0].baseValue;
    const percentChange = baseValue === 0 ? 0 : (value / baseValue) * 100;
    
    // For the first run, use pure red or green based on sign
    if (index === 0) {
      return percentChange >= 0 ? 'rgb(0, 255, 0)' : 'rgb(255, 0, 0)';
    }

    // Calculate global maximum absolute value across all runs
    const maxAbsValue = Math.max(...runResults.map(r => {
      const base = mode === Mode.GLOBAL_ZERO_RELATIVE ? r.baseValueGlobal : r.baseValue;
      return base === 0 ? 0 : Math.abs(r.deltaValue / base * 100);
    }));
    const clampedValue = Math.max(-maxAbsValue, Math.min(maxAbsValue, percentChange));
    const normalizedValue = (clampedValue + maxAbsValue) / (2 * maxAbsValue);
    
    // For negative values (red to gray)
    if (normalizedValue < 0.5) {
      const t = normalizedValue * 2;
      const red = 255;
      const green = Math.round(192 * t);
      const blue = Math.round(192 * t);
      return `rgb(${red}, ${green}, ${blue})`;
    }
    // For positive values (gray to green)
    else {
      const t = (normalizedValue - 0.5) * 2;
      const red = Math.round(192 * (1 - t));
      const green = Math.round(192 + (255 - 192) * t);
      const blue = Math.round(192 * (1 - t));
      return `rgb(${red}, ${green}, ${blue})`;
    }
  };

  // Group results by run
  const runs = [];
  for (let i = 0; i < runResults.length; i += 16) {
    const run = runResults.slice(i, i + 16);
    if (run.length > 0) {
      runs.push(run);
    }
  }

  return (
    <div className={styles.container}>
      <h3>Experiment Results</h3>
      <div className={styles.runsContainer}>
        {runs.map((runResults, runIndex) => {
          return (
            <div key={runIndex} className={styles.runGrid}>
              <div className={styles.runHeader}>Run {runIndex + 1}</div>
              <div className={styles.parameterGrid}>
                {runResults.map((result, index) => {
                  const percentChange = result.baseValue === 0 ? 0 : (result.deltaValue / result.baseValue) * 100;
                  return (
                    <div
                      key={index}
                      className={`${styles.square} ${!result.isComplete ? styles.inProgress : ''}`}
                      style={{ backgroundColor: getColor(result.deltaValue, runIndex * 16 + index) }}
                      title={`K:${result.stochasticParams.kPeriod} D:${result.stochasticParams.dPeriod} S:${result.stochasticParams.slowingPeriod} T:${result.strategyParams.threshold} - ${percentChange.toFixed(2)}% (${result.isComplete ? 'Complete' : 'In Progress'})`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExperimentResultsDisplay; 