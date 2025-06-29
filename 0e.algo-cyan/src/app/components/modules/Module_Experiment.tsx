'use client';

import React from 'react';
import BaseModule, { BaseModuleProps } from './BaseModule';
import ExperimentResultsDisplayV2 from '../ExperimentResultsDisplayV2';
import { ReadOnlyPubSub } from '@/lib/infra/PubSub';
import { IntelligenceV1 } from '@/lib/base/Intelligence';
import { RunResultV2 } from '@/lib/base/RunResultV2';
import styles from './Module_Experiment.module.css';

interface ModuleExperimentProps extends BaseModuleProps {}

const Module_Experiment: React.FC<ModuleExperimentProps> = ({ onClose, gridSize, title }) => {
  // For now, we'll create empty data structures
  // This will be connected to data sources later
  const emptyRunResults: RunResultV2[] = [];
  const emptyEventFeeds: ReadOnlyPubSub<IntelligenceV1>[] = [];

  return (
    <BaseModule onClose={onClose} title={title} gridSize={gridSize}>
      <div className={styles.content} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className={styles.experimentContainer} style={{ flex: '1 1 auto', width: '100%' }}>
          <ExperimentResultsDisplayV2 
            runResults={emptyRunResults} 
            eventPubSubs={emptyEventFeeds}
          />
        </div>
      </div>
    </BaseModule>
  );
};

export default Module_Experiment; 