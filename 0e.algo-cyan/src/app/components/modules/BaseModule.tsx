'use client';

import React, { useContext, useRef, useEffect } from 'react';
import styles from './BaseModule.module.css';
import { WireContext } from '../Workspace';

export interface BaseModuleProps {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  gridSize?: {
    cols: number;
    rows: number;
  };
}

interface WindowWithRegister extends Window {
  __registerSocketPosition?: (id: string, pos: { x: number; y: number }) => void;
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

  // --- Wire Sockets ---
  const wireCtx = useContext(WireContext);
  const headerSocketRef = useRef<HTMLDivElement>(null);
  const footerSocketRef = useRef<HTMLDivElement>(null);
  const moduleId = React.useId();
  const headerSocketId = `${moduleId}-header`;
  const footerSocketId = `${moduleId}-footer`;

  // Register socket positions on layout
  useEffect(() => {
    const register = (ref: React.RefObject<HTMLDivElement>, id: string) => {
      if (ref.current && wireCtx?.containerRef.current) {
        const rect = ref.current.getBoundingClientRect();
        const containerRect = wireCtx.containerRef.current.getBoundingClientRect();
        const x = rect.left + rect.width / 2 - containerRect.left;
        const y = rect.top + rect.height / 2 - containerRect.top;
        (window as WindowWithRegister).__registerSocketPosition?.(id, { x, y });
      }
    };
    register(headerSocketRef, headerSocketId);
    register(footerSocketRef, footerSocketId);
    // Re-register on window resize/scroll
    const onResize = () => {
      register(headerSocketRef, headerSocketId);
      register(footerSocketRef, footerSocketId);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize);
    };
  });

  // --- Drag logic ---
  const handleSocketMouseDown = (id: string, ref: React.RefObject<HTMLDivElement>) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (!wireCtx || !wireCtx.containerRef.current) return;
    const containerRect = wireCtx.containerRef.current.getBoundingClientRect();
    const startPos = {
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
    };
    wireCtx.startWire(id, startPos);
    const onMove = (ev: MouseEvent) => {
      if (!wireCtx?.containerRef.current) return;
      const containerRect = wireCtx.containerRef.current.getBoundingClientRect();
      const x = ev.clientX - containerRect.left;
      const y = ev.clientY - containerRect.top;
      wireCtx.updateWire({ x, y });
    };
    let handled = false;
    const onUp = (ev: MouseEvent) => {
      if (handled) return;
      handled = true;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // Check if released over a socket
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      if (target && (target as HTMLElement).dataset.socketId) {
        const socketId = (target as HTMLElement).dataset.socketId!;
        wireCtx.endWire(socketId);
      } else {
        wireCtx.cancelWire();
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // --- Socket props ---
  const socketProps = (id: string, ref: React.RefObject<HTMLDivElement>) => ({
    ref,
    'data-socket-id': id,
    onMouseDown: handleSocketMouseDown(id, ref),
    tabIndex: 0,
    style: { cursor: 'crosshair' },
  });

  return (
    <div className={styles.module} style={gridStyle}>
      <div className={styles.moduleHeader}>
        <div className={`${styles.socket} ${styles.headerSocket}`} {...socketProps(headerSocketId, headerSocketRef)} />
        <h3 className={styles.moduleTitle}>{title}</h3>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
      </div>
      <div className={styles.moduleContent}>
        {children}
      </div>
      <div className={styles.moduleFooter}>
        <div className={`${styles.socket} ${styles.footerSocket}`} {...socketProps(footerSocketId, footerSocketRef)} />
      </div>
    </div>
  );
};

export default BaseModule; 