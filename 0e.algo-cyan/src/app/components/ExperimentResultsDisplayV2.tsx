import React, { useState, useEffect } from 'react';
import styles from './ExperimentResultsDisplayV2.module.css';
import { ReadOnlyPubSub } from '@/lib/infra/PubSub';
import { RunResultV2 } from '@/lib/base/RunResultV2';
import { IntelligenceV1, IntelligenceV1Type } from '@/lib/base/Intelligence';

export enum Mode {
  ABSOLUTE = 'ABSOLUTE',
  GLOBAL_ZERO_RELATIVE = 'GLOBAL_ZERO_RELATIVE',
  GLOBAL_RELATIVE = 'GLOBAL_RELATIVE',
  RUN_ZERO_RELATIVE = 'RUN_ZERO_RELATIVE',
  RUN_RELATIVE = 'RUN_RELATIVE'
}

interface ExperimentResultsDisplayProps {
  runResults: RunResultV2[];
  eventPubSubs?: ReadOnlyPubSub<IntelligenceV1>[];
}

const ExperimentResultsDisplay: React.FC<ExperimentResultsDisplayProps> = ({ runResults, eventPubSubs }) => {
  const [mode, setMode] = useState<Mode>(Mode.RUN_ZERO_RELATIVE);
  const [isSetupView, setIsSetupView] = useState(false);
  const [adjustForQuotes, setAdjustForQuotes] = useState(true);
  const [animationStates, setAnimationStates] = useState<{ [key: number]: 'ping' | 'bounce' | null }>({});
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  useEffect(() => {
    if (!eventPubSubs) return;

    const unsubscribes = eventPubSubs.map((pubSub, index) => {
      return pubSub.subscribe((intelligence: IntelligenceV1) => {
        if (intelligence.type !== IntelligenceV1Type.PRESIGNAL && intelligence.type !== IntelligenceV1Type.SIGNAL) {
          return;
        }
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
            newStates[targetIndex] = intelligence.type === IntelligenceV1Type.SIGNAL ? 'bounce' : 'ping';
            // Clear the animation after it completes
            setTimeout(() => {
              setAnimationStates(current => {
                const updated = { ...current };
                if (updated[targetIndex] === (intelligence.type === IntelligenceV1Type.SIGNAL ? 'bounce' : 'ping')) {
                  delete updated[targetIndex];
                }
                return updated;
              });
            }, intelligence.type === IntelligenceV1Type.SIGNAL ? 700 : 500); // Match animation durations
          }
          return newStates;
        });
      });
    });

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [eventPubSubs, runResults, isSetupView]);

  const getColor = (deltaAccountValue: number, index: number) => {

    const runStartIndex = Math.floor(index / 16) * 16;
    const relevantResults = 
        mode === Mode.GLOBAL_RELATIVE || mode === Mode.GLOBAL_ZERO_RELATIVE
            ? runResults
            : runResults.slice(runStartIndex, runStartIndex + 16);

    if (mode === Mode.GLOBAL_RELATIVE || mode === Mode.RUN_RELATIVE) {
      // For relative modes, use yellow to blue color scheme
      const minDeltaAccountValue = Math.min(...relevantResults.map(r => r.deltaAccountValue));
      const maxDeltaAccountValue = Math.max(...relevantResults.map(r => r.deltaAccountValue));
      const range = maxDeltaAccountValue - minDeltaAccountValue;
      
      if (range === 0) return 'rgb(192, 192, 192)'; // Gray for no range
      
      const normalizedValue = (deltaAccountValue - minDeltaAccountValue) / range;
      
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

    const maxAbsoluteReturnOnCapital = Math.max(...relevantResults.map(r => {
      let adjusted = r.deltaAccountValue;
      if (adjustForQuotes && r.finalQuote !== 0) {
        adjusted *= r.originalQuote / r.finalQuote;
      }
      return Math.abs(adjusted / r.maxNetCapitalExposure);
    }));

    let adjustedDeltaAccountValue = deltaAccountValue;
    if (adjustForQuotes && runResults[index].finalQuote !== 0) {
      adjustedDeltaAccountValue *= runResults[index].originalQuote / runResults[index].finalQuote;
    }
    const returnOnCapital = adjustedDeltaAccountValue / runResults[index].maxNetCapitalExposure;
    
    const normalizedValue = (returnOnCapital / maxAbsoluteReturnOnCapital + 1) / 2;
    
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
    const setupGroups: RunResultV2[][] = Array(16).fill(null).map(() => []);
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
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        padding: '20px'
      }}>
        {groups.map((groupResults, groupIndex) => {
          return (
            <div key={groupIndex} className={styles.runGrid} style={{
              display: 'grid',
              gap: '4px',
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
                  // In setup view, each group contains results from different runs
                  // We need to calculate the original index in runResults
                  const globalIndex = isSetupView ? 
                    groupIndex + (index * 16) : // Each result in a setup group is from a different run
                    groupIndex * 16 + index;    // In run view, just use the group and index
                  const animationClass = !result.isComplete ? animationStates[globalIndex] || '' : '';
                  const isSelected = selectedIndex === globalIndex;
                  return (
                    <div
                      key={index}
                      className={`${styles.square} ${!result.isComplete ? styles.inProgress : ''} ${animationClass ? styles[animationClass] : ''}`}
                      style={{
                        backgroundColor: getColor(result.deltaAccountValue, globalIndex),
                        border: isSelected ? '5px solid #000' : '2px solid transparent',
                        boxSizing: 'border-box'
                      }}
                      onClick={() => {
                        setSelectedIndex(globalIndex);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {/* Info Panels */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '32px' }}>
        <div style={{ flex: 1, background: '#fff', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '16px', minHeight: '80px' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Variation</div>
          {selectedIndex !== null && runResults[selectedIndex] ? (
            <div>
              <div style={{ fontSize: 14 }}>
                <div><b>Signals:</b> {runResults[selectedIndex].getSignalCount()} ({(runResults[selectedIndex].getSignalCount()/(runResults[selectedIndex].durationMs/(24*60*60*1000))).toFixed(0)}/d)</div>
                <div><b>Avg. Time btwn Signals:</b> {runResults[selectedIndex].getAverageTimeBetweenSignals().toFixed(0)}ms (std: {runResults[selectedIndex].getStdDeviationTimeBetweenSignals().toFixed(0)}ms)</div>
                <div><b>Oversignals:</b> {runResults[selectedIndex].getOversignalCount()} (ratio: {runResults[selectedIndex].getOversignalRatio().toFixed(2)})</div>
                <div><b>Presignals:</b> {runResults[selectedIndex].getPresignalCount()}</div>
              </div>
              <div style={{ fontSize: 14 }}>
                <div><b>Stochastic:</b> K: {runResults[selectedIndex].stochasticParams.kPeriod}, D: {runResults[selectedIndex].stochasticParams.dPeriod}, S: {runResults[selectedIndex].stochasticParams.slowingPeriod}</div>
                <div><b>Threshold:</b> {runResults[selectedIndex].strategyParams.threshold}</div>
                <div><b>Δ Value:</b> {runResults[selectedIndex].deltaAccountValue}</div>
                <div><b>Max Exposure:</b> {runResults[selectedIndex].maxNetCapitalExposure}</div>
                <div><b>Status:</b> {runResults[selectedIndex].isComplete ? 'Complete' : 'In Progress'}</div>
              </div>
            </div>
          ) : (
            <div>No variation selected.</div>
          )}
        </div>
        <div style={{ flex: 1, background: '#fff', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '16px', minHeight: '80px' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Run</div>
          <div>No run selected.</div>
        </div>
        <div style={{ flex: 1, background: '#fff', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '16px', minHeight: '80px' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Overall</div>
          <div></div>
        </div>
      </div>
    </div>
  );
};

export default ExperimentResultsDisplay; 