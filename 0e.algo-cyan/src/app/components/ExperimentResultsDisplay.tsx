import React from 'react';
import styles from './ExperimentResultsDisplay.module.css';

interface ExperimentResultsDisplayProps {
  finalValues: number[];
}

const ExperimentResultsDisplay: React.FC<ExperimentResultsDisplayProps> = ({ finalValues }) => {
  const getColor = (value: number) => {
    const maxAbsValue = Math.max(...finalValues.map(Math.abs));
    const clampedValue = Math.max(-maxAbsValue, Math.min(maxAbsValue, value));
    const normalizedValue = (clampedValue + maxAbsValue) / (2 * maxAbsValue); // Convert from [-maxAbsValue,maxAbsValue] to [0,1]
    
    // For negative values (red to gray)
    if (normalizedValue < 0.5) {
      const t = normalizedValue * 2; // Scale to [0,1]
      const red = 255;
      const green = Math.round(192 * t);
      const blue = Math.round(192 * t);
      return `rgb(${red}, ${green}, ${blue})`;
    }
    // For positive values (gray to green)
    else {
      const t = (normalizedValue - 0.5) * 2; // Scale to [0,1]
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

  const { rows, cols } = getGridSize(finalValues.length);

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
        {finalValues.map((value, index) => (
          <div
            key={index}
            className={styles.square}
            style={{ backgroundColor: getColor(value) }}
            title={`Run ${index + 1}: ${value.toFixed(2)}%`}
          />
        ))}
      </div>
    </div>
  );
};

export default ExperimentResultsDisplay; 