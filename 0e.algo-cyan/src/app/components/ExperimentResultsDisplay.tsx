import React, { useState } from 'react';
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
}

const ExperimentResultsDisplay: React.FC<ExperimentResultsDisplayProps> = ({ runResults }) => {
  const [mode, setMode] = useState<Mode>(Mode.RUN_ZERO_RELATIVE);
  const [isSetupView, setIsSetupView] = useState(false);
  
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

  // Group results by run or setup
  const groups = [];
  if (isSetupView) {
    // Group by setup number (0-15)
    const setupGroups: RunResult[][] = Array(16).fill(null).map(() => []);
    runResults.forEach((result, index) => {
      const setupIndex = index % 16;
      setupGroups[setupIndex].push(result);
    });
    groups.push(...setupGroups.filter(group => group.length > 0));
  } else {
    // Group by run (16 results per run)
    for (let i = 0; i < runResults.length; i += 16) {
      const run = runResults.slice(i, i + 16);
      if (run.length > 0) {
        groups.push(run);
      }
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Experiment Results</h3>
        <div className={styles.controls}>
          <select 
            value={mode} 
            onChange={(e) => setMode(e.target.value as Mode)}
            className={styles.modeSelect}
          >
            <option value={Mode.ABSOLUTE}>Absolute Values</option>
            <option value={Mode.GLOBAL_ZERO_RELATIVE}>Global Zero Relative</option>
            <option value={Mode.GLOBAL_RELATIVE}>Global Relative</option>
            <option value={Mode.RUN_ZERO_RELATIVE}>Run Zero Relative</option>
            <option value={Mode.RUN_RELATIVE}>Run Relative</option>
          </select>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={isSetupView}
              onChange={(e) => setIsSetupView(e.target.checked)}
            />
            <span className={styles.toggleLabel}>Setup View</span>
          </label>
        </div>
      </div>
      <div className={styles.runsContainer}>
        {groups.map((groupResults, groupIndex) => {
          return (
            <div key={groupIndex} className={styles.runGrid}>
              <div className={styles.runHeader}>
                {isSetupView ? `Setup ${groupIndex + 1}` : `Run ${groupIndex + 1}`}
              </div>
              <div className={styles.parameterGrid} style={{
                gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(groupResults.length))}, 20px)`,
                gridTemplateRows: `repeat(${Math.ceil(Math.sqrt(groupResults.length))}, 20px)`
              }}>
                {groupResults.map((result, index) => {
                  const percentChange = result.baseValue === 0 ? 0 : (result.deltaValue / result.baseValue) * 100;
                  return (
                    <div
                      key={index}
                      className={`${styles.square} ${!result.isComplete ? styles.inProgress : ''}`}
                      style={{ backgroundColor: getColor(result.deltaValue, isSetupView ? index : groupIndex * 16 + index) }}
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