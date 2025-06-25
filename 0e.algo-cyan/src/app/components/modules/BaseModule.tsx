'use client';

import React from 'react';
import styles from './BaseModule.module.css';

export interface BaseModuleProps {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  gridSize?: {
    cols: number;
    rows: number;
  };
}

const BaseModule: React.FC<BaseModuleProps> = ({ onClose, title, children, gridSize = { cols: 1, rows: 1 } }) => {
  const gridStyle = {
    gridColumn: `span ${gridSize.cols}`,
    gridRow: `span ${gridSize.rows}`,
    minWidth: 0,
    minHeight: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
  };

  return (
    <div className={styles.module} style={gridStyle}>
      <div className={styles.moduleHeader}>
        <div className={`${styles.socket} ${styles.headerSocket}`} />
        <h3 className={styles.moduleTitle}>{title}</h3>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
      </div>
      <div className={styles.moduleContent}>
        {children}
      </div>
      <div className={styles.moduleFooter}>
        <div className={`${styles.socket} ${styles.footerSocket}`} />
      </div>
    </div>
  );
};

export default BaseModule; 