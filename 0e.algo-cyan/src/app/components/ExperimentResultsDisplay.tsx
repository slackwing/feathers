import React, { useState, useEffect } from 'react';
import styles from './ExperimentResultsDisplay.module.css';
import { RunResult } from '@/lib/base/RunResult';
import { ReadOnlyPubSub } from '@/lib/infra/PubSub';

export enum Mode {
  ABSOLUTE = 'ABSOLUTE',
  GLOBAL_ZERO_RELATIVE = 'GLOBAL_ZERO_RELATIVE',
  GLOBAL_RELATIVE = 'GLOBAL_RELATIVE',
  RUN_ZERO_RELATIVE = 'RUN_ZERO_RELATIVE',
  RUN_RELATIVE = 'RUN_RELATIVE'
}

interface ExperimentResultsDisplayProps {
  runResults: RunResult[];
  eventPubSubs?: ReadOnlyPubSub<boolean>[];
  globalBaseValue?: number;
}

const ExperimentResultsDisplay: React.FC<ExperimentResultsDisplayProps> = ({ runResults, eventPubSubs, globalBaseValue }) => {
  const [mode, setMode] = useState<Mode>(Mode.RUN_ZERO_RELATIVE);
  const [isSetupView, setIsSetupView] = useState(false);
  const [adjustForQuotes, setAdjustForQuotes] = useState(true);
  const [animationStates, setAnimationStates] = useState<{ [key: number]: 'ping' | 'bounce' | null }>({});
  
  useEffect(() => {
    if (!eventPubSubs) return;

    const unsubscribes = eventPubSubs.map((pubSub, index) => {
      return pubSub.subscribe((isMajor: boolean) => {
        setAnimationStates(prev => {
          const newStates = { ...prev };
          // Find the most recent run
          const currentRunIndex = Math.floor(runResults.length / 16) - 1;
          if (currentRunIndex < 0) return newStates;

          // Calculate the target index based on view mode
          const targetIndex = isSetupView ?
            // In setup view: setup index + (most recent run * 16)
            index + (currentRunIndex * 16) :
            // In run view: (current run * 16) + setup index
            (currentRunIndex * 16) + index;

          // Only animate if the result exists and isn't complete
          if (targetIndex < runResults.length && !runResults[targetIndex].isComplete) {
            newStates[targetIndex] = isMajor ? 'bounce' : 'ping';
            // Clear the animation after it completes
            setTimeout(() => {
              setAnimationStates(current => {
                const updated = { ...current };
                if (updated[targetIndex] === (isMajor ? 'bounce' : 'ping')) {
                  delete updated[targetIndex];
                }
                return updated;
              });
            }, isMajor ? 700 : 500); // Match animation durations
          }
          return newStates;
        });
      });
    });

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [eventPubSubs, runResults, isSetupView]);

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

    const baseValue = mode === Mode.GLOBAL_ZERO_RELATIVE ? (globalBaseValue ?? 0) : runResults[index].baseValue;
    let percentChange = baseValue === 0 ? 0 : (value / baseValue) * 100;
    
    if (adjustForQuotes && runResults[index].originalQuote !== 0) {
      percentChange *= runResults[index].originalQuote / runResults[index].finalQuote;
    }
    
    // Calculate global maximum absolute value across all runs
    const maxAbsValue = Math.max(...runResults.map(r => {
      const base = mode === Mode.GLOBAL_ZERO_RELATIVE ? (globalBaseValue ?? 0) : r.baseValue;
      let percent = base === 0 ? 0 : Math.abs(r.deltaValue / base * 100);
      if (adjustForQuotes && r.originalQuote !== 0) {
        percent *= r.originalQuote / r.finalQuote;
      }
      return percent;
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
              onChange={(e) => {
                setIsSetupView(e.target.checked);
                setAnimationStates({}); // Clear animations when switching views
              }}
            />
            <span className={styles.toggleLabel}>Setup View</span>
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={adjustForQuotes}
              onChange={(e) => setAdjustForQuotes(e.target.checked)}
            />
            <span className={styles.toggleLabel}>Adjust for Quotes</span>
          </label>
        </div>
      </div>
      <div className={styles.runsContainer} style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, auto))',
        gap: '40px',
        padding: '20px'
      }}>
        {groups.map((groupResults, groupIndex) => {
          return (
            <div key={groupIndex} className={styles.runGrid} style={{
              display: 'grid',
              gap: '4px',
              margin: '0',
              padding: '0'
            }}>
              <div className={styles.runHeader}>
                {isSetupView ? `Setup ${groupIndex + 1}` : `Run ${groupIndex + 1}`}
              </div>
              <div className={styles.parameterGrid} style={{
                gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(groupResults.length))}, 20px)`,
                gridTemplateRows: `repeat(${Math.ceil(Math.sqrt(groupResults.length))}, 20px)`,
                width: `${Math.ceil(Math.sqrt(groupResults.length)) * 20}px`,
                height: `${Math.ceil(Math.sqrt(groupResults.length)) * 20}px`
              }}>
                {groupResults.map((result, index) => {
                  const percentChange = result.baseValue === 0 ? 0 : (result.deltaValue / result.baseValue) * 100;
                  // In setup view, each group contains results from different runs
                  // We need to calculate the original index in runResults
                  const globalIndex = isSetupView ? 
                    groupIndex + (index * 16) : // Each result in a setup group is from a different run
                    groupIndex * 16 + index;    // In run view, just use the group and index
                  const animationClass = !result.isComplete ? animationStates[globalIndex] || '' : '';
                  return (
                    <div
                      key={index}
                      className={`${styles.square} ${!result.isComplete ? styles.inProgress : ''} ${animationClass ? styles[animationClass] : ''}`}
                      style={{ backgroundColor: getColor(result.deltaValue, globalIndex) }}
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