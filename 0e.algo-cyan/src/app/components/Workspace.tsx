'use client';

import React, { useState } from 'react';
import Module_Selector from './modules/Module_Selector';
import Module_ExchangeDataSource from './modules/Module_ExchangeDataSource';
import Module_FileDataSource from './modules/Module_FileDataSource';
import Module_MarketDepthHistogram from './modules/Module_MarketDepthHistogram';
import Module_OrderBook from './modules/Module_OrderBook';
import Module_Experiment from './modules/Module_Experiment';
import styles from './Workspace.module.css';

export type ModuleType = 'exchange-data-source' | 'file-data-source' | 'market-depth-histogram' | 'order-book' | 'experiment' | 'test-dummy';

export interface ModuleState {
  id: string;
  type: ModuleType;
  data?: Record<string, unknown>;
}

const Workspace: React.FC = () => {
  const [loadedModules, setLoadedModules] = useState<ModuleState[]>([]);

  const handleModuleSelect = (moduleType: ModuleType) => {
    const newModule: ModuleState = {
      id: `${moduleType}-${Date.now()}`,
      type: moduleType,
    };
    setLoadedModules(prev => [...prev, newModule]);
  };

  const handleModuleClose = (moduleId: string) => {
    setLoadedModules(prev => prev.filter(module => module.id !== moduleId));
  };

  const getModuleGridSize = (moduleType: ModuleType) => {
    switch (moduleType) {
      case 'exchange-data-source':
        return { cols: 2, rows: 2 };
      case 'file-data-source':
        return { cols: 2, rows: 2 };
      case 'market-depth-histogram':
        return { cols: 2, rows: 2 };
      case 'order-book':
        return { cols: 2, rows: 3 };
      case 'experiment':
        return { cols: 5, rows: 3 };
      case 'test-dummy':
        return { cols: 3, rows: 2 };
      default:
        return { cols: 1, rows: 2 };
    }
  };

  const renderModule = (module: ModuleState) => {
    const gridSize = getModuleGridSize(module.type);
    const commonProps = {
      key: module.id,
      onClose: () => handleModuleClose(module.id),
      gridSize,
    };

    switch (module.type) {
      case 'exchange-data-source':
        return <Module_ExchangeDataSource {...commonProps} title="Exchange Data Source" />;
      case 'file-data-source':
        return <Module_FileDataSource {...commonProps} title="File Data Source" />;
      case 'market-depth-histogram':
        return <Module_MarketDepthHistogram {...commonProps} title="Market Depth Histogram" />;
      case 'order-book':
        return <Module_OrderBook {...commonProps} title="Order Book" />;
      case 'experiment':
        return <Module_Experiment {...commonProps} title="Experiment" />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.workspace}>
      <div className={styles.modulesContainer}>
        {loadedModules.map(renderModule)}
        <div className={styles.selectorModule}>
          <Module_Selector onModuleSelect={handleModuleSelect} />
        </div>
      </div>
    </div>
  );
};

export default Workspace; 