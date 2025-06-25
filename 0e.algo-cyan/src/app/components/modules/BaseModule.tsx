'use client';

import React from 'react';
import styles from './BaseModule.module.css';

export interface BaseModuleProps {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const BaseModule: React.FC<BaseModuleProps> = ({ onClose, title, children }) => {
  return (
    <div className={styles.module}>
      <div className={styles.moduleHeader}>
        <h3 className={styles.moduleTitle}>{title}</h3>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
      </div>
      <div className={styles.moduleContent}>
        {children}
      </div>
    </div>
  );
};

export default BaseModule; 