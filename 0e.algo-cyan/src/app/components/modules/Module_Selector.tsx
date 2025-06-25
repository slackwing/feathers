'use client';

import React from 'react';
import { ModuleType } from '../Workspace';
import styles from './Module_Selector.module.css';

interface ModuleSelectorProps {
  onModuleSelect: (moduleType: ModuleType) => void;
}

const Module_Selector: React.FC<ModuleSelectorProps> = ({ onModuleSelect }) => {
  const modules = [
    {
      type: 'exchange-data-source' as ModuleType,
      icon: '🌐',
      caption: 'Exchange Data Source',
      description: 'Connect to live market data'
    },
    {
      type: 'file-data-source' as ModuleType,
      icon: '📁',
      caption: 'File Data Source',
      description: 'Load data from files'
    },
    {
      type: 'market-depth-histogram' as ModuleType,
      icon: '📊',
      caption: 'Market Depth Histogram',
      description: 'View market depth visualization'
    },
    {
      type: 'order-book' as ModuleType,
      icon: '📖',
      caption: 'Order Book',
      description: 'View order book data'
    },
    {
      type: 'experiment' as ModuleType,
      icon: '🧪',
      caption: 'Experiment',
      description: 'Run and view experiments'
    }
  ];

  return (
    <div className={styles.moduleSelector}>
      <div className={styles.moduleGrid}>
        {modules.map((module) => (
          <div
            key={module.type}
            className={styles.moduleIcon}
            onClick={() => onModuleSelect(module.type)}
            title={module.description}
          >
            <div className={styles.icon}>{module.icon}</div>
            <div className={styles.caption}>{module.caption}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Module_Selector; 