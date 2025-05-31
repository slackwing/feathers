import React from 'react';
import styles from './ExperimentResultsDisplay.module.css';
import { RunResult } from '@/lib/base/RunResult';

interface ExperimentResultsDisplayProps {
  runResults: RunResult[];
}

const ExperimentResultsDisplay: React.FC<ExperimentResultsDisplayProps> = ({ runResults }) => {
  const getColor = (value: number, index: number) => {
    const percentChange = ((value - runResults[0].initialValue) / runResults[0].initialValue) * 100;
    
    // For the first run, use pure red or green based on sign
    if (index === 0) {
      return percentChange >= 0 ? 'rgb(0, 255, 0)' : 'rgb(255, 0, 0)';
    }

    const maxAbsValue = Math.max(...runResults.slice(0, index).map(r => Math.abs((r.currentValue - r.initialValue) / r.initialValue * 100)));
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

  const getGridSize = (count: number) => {
    const size = Math.ceil(Math.sqrt(count));
    return { rows: size, cols: size };
  };

  const { rows, cols } = getGridSize(runResults.length);

  return (
    <div className={styles.container}>
      <h3>Experiment Results</h3>
      <div 
        className={styles.grid} 
        style={{ 
          gridTemplateColumns: `repeat(${cols}, 20px)`,
          gridTemplateRows: `repeat(${rows}, 20px)`,
          gap: '4px'
        }}
      >
        {runResults.map((result, index) => {
          const percentChange = ((result.currentValue - result.initialValue) / result.initialValue) * 100;
          return (
            <div
              key={index}
              className={`${styles.square} ${!result.isComplete ? styles.inProgress : ''}`}
              style={{ backgroundColor: getColor(result.currentValue, index) }}
              title={`Run ${index + 1}: ${percentChange.toFixed(2)}% (${result.isComplete ? 'Complete' : 'In Progress'})`}
            />
          );
        })}
      </div>
    </div>
  );
};

export default ExperimentResultsDisplay; 