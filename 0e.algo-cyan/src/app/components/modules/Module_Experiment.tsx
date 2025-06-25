'use client';

import React from 'react';
import BaseModule, { BaseModuleProps } from './BaseModule';
import ExperimentResultsDisplayV2 from '../ExperimentResultsDisplayV2';
import { ReadOnlyPubSub } from '@/lib/infra/PubSub';
import { IntelligenceV1 } from '@/lib/base/Intelligence';
import { RunResultV2 } from '@/lib/base/RunResultV2';
import styles from './Module_Experiment.module.css';

interface ModuleExperimentProps extends BaseModuleProps {}

const Module_Experiment: React.FC<ModuleExperimentProps> = ({ onClose }) => {
  // For now, we'll create empty data structures
  // This will be connected to data sources later
  const emptyRunResults: RunResultV2[] = [];
  const emptyEventFeeds: ReadOnlyPubSub<IntelligenceV1>[] = [];

  return (
    <BaseModule onClose={onClose} title="Experiment">
      <div className={styles.content}>
        <div className={styles.experimentContainer}>
          <ExperimentResultsDisplayV2 
            runResults={emptyRunResults} 
            eventPubSubs={emptyEventFeeds}
          />
        </div>
        
        <div className={styles.info}>
          <p>This module displays experiment results and intelligence data.</p>
          <p>Connect to data sources to run experiments and view results.</p>
        </div>
      </div>
    </BaseModule>
  );
};

export default Module_Experiment; 