'use client';

import React, { useState, useRef } from 'react';
import { FileDataAdapter } from '../../adapters/FileDataAdapter';
import { BTCUSD_ } from '@/lib/derived/AssetPairs';
import BaseModule, { BaseModuleProps } from './BaseModule';
import FileOrderingDisplay from '../FileOrderingDisplay';
import styles from './Module_FileDataSource.module.css';

interface ModuleFileDataSourceProps extends BaseModuleProps {}

const Module_FileDataSource: React.FC<ModuleFileDataSourceProps> = ({ onClose, gridSize, title }) => {
  const [fileAdapter] = useState(() => new FileDataAdapter(BTCUSD_));
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [areExperimentsRunning, setAreExperimentsRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      console.log('No files selected');
      return;
    }
    
    if (files.length === 1) {
      // Single file - run experiment immediately
      try {
        await fileAdapter.loadFile(files);
        console.log('File loaded successfully');
        setAreExperimentsRunning(true);
      } catch (error) {
        console.error('Error loading file:', error);
      }
    } else {
      // Multiple files - show file selection UI
      setSelectedFiles(files);
    }
  };

  const handleRunExperiment = async () => {
    if (selectedFiles.length === 0) return;
    
    try {
      await fileAdapter.loadFile(selectedFiles);
      console.log('File loaded successfully');
      setAreExperimentsRunning(true);
    } catch (error) {
      console.error('Error loading file:', error);
    }
  };

  const handleFileReorder = (newOrder: File[]) => {
    setSelectedFiles(newOrder);
  };

  const handleSelectFiles = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <BaseModule onClose={onClose} title={title} gridSize={gridSize}>
      <div className={styles.content} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          accept=".ndjson"
          multiple
        />

        <div style={{ flex: '1 1 auto', width: '100%', display: 'flex', flexDirection: 'column' }}>
          {selectedFiles.length === 0 ? (
            <div className={styles.placeholder} style={{ flex: '1 1 auto' }}>
              <p>No files selected</p>
              <button className={styles.selectButton} onClick={handleSelectFiles}>
                Select Files
              </button>
            </div>
          ) : (
            <div className={styles.fileSection} style={{ flex: '1 1 auto' }}>
              <div className={styles.fileHeader}>
                <span>{selectedFiles.length} files selected</span>
                <button className={styles.selectButton} onClick={handleSelectFiles}>
                  Change Files
                </button>
              </div>
              
              {selectedFiles.length > 1 && !areExperimentsRunning && (
                <FileOrderingDisplay
                  files={selectedFiles}
                  onReorder={handleFileReorder}
                  onRun={handleRunExperiment}
                />
              )}
              
              {areExperimentsRunning && (
                <div className={styles.runningStatus}>
                  <p>Replaying data from files...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </BaseModule>
  );
};

export default Module_FileDataSource; 