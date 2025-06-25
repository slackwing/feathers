'use client';

import React, { useState, useRef, useLayoutEffect } from 'react';
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

// --- Wire System Scaffold ---
export interface Wire {
  from: string; // socketId
  to: string; // socketId
  color: string;
}

interface WireContextType {
  wires: Wire[];
  startWire: (from: string, startPos: { x: number; y: number }) => void;
  updateWire: (pos: { x: number; y: number }) => void;
  endWire: (to: string) => void;
  cancelWire: () => void;
  draggingWire: null | { from: string; startPos: { x: number; y: number }; currentPos: { x: number; y: number } };
  containerRef: React.RefObject<HTMLDivElement>;
}

export const WireContext = React.createContext<WireContextType | null>(null);

// --- WireOverlay SVG ---
const WireOverlay: React.FC<{ wires: Wire[]; draggingWire: WireContextType['draggingWire'] }> = ({ wires, draggingWire }) => {
  const [socketPositions, setSocketPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Expose a way for sockets to register their positions
  React.useEffect(() => {
    (window as any).__registerSocketPosition = (id: string, pos: { x: number; y: number }) => {
      setSocketPositions(prev => ({ ...prev, [id]: pos }));
    };
    return () => {
      (window as any).__registerSocketPosition = undefined;
    };
  }, []);

  // Helper to get a random color
  const getColor = (color: string) => color;

  // Helper to draw a wire path
  const makePath = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = Math.abs(b.x - a.x);
    return `M${a.x},${a.y} C${a.x + dx / 2},${a.y} ${b.x - dx / 2},${b.y} ${b.x},${b.y}`;
  };

  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 100 }}>
      {wires.map((wire, i) => {
        const from = socketPositions[wire.from];
        const to = socketPositions[wire.to];
        if (!from || !to) return null;
        return (
          <path 
            key={i} 
            d={makePath(from, to)} 
            stroke={getColor(wire.color)} 
            strokeWidth={6} 
            fill="none"
            style={{ 
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
              strokeLinecap: 'round'
            }}
          />
        );
      })}
      {draggingWire && (
        <path
          d={makePath(draggingWire.startPos, draggingWire.currentPos)}
          stroke="#888"
          strokeWidth={6}
          fill="none"
          style={{ 
            pointerEvents: 'none', 
            strokeDasharray: '8 4',
            strokeLinecap: 'round',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))'
          }}
        />
      )}
    </svg>
  );
};

const Workspace: React.FC = () => {
  const [loadedModules, setLoadedModules] = useState<ModuleState[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [draggingWire, setDraggingWire] = useState<WireContextType['draggingWire']>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

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

  // --- Wire context actions ---
  const startWire = (from: string, startPos: { x: number; y: number }) => {
    console.log('[START WIRE DEBUG] Starting wire from:', from, 'at position:', startPos);
    setDraggingWire({ from, startPos, currentPos: startPos });
  };
  const updateWire = (pos: { x: number; y: number }) => {
    console.log('[UPDATE WIRE DEBUG] Updating wire position to:', pos, 'current draggingWire:', draggingWire);
    setDraggingWire(d => {
      if (!d) {
        console.log('[UPDATE WIRE DEBUG] No dragging wire to update!');
        return null;
      }
      const updated = { ...d, currentPos: pos };
      console.log('[UPDATE WIRE DEBUG] Updated dragging wire:', updated);
      return updated;
    });
  };
  const endWire = (to: string) => {
    console.log('[END WIRE DEBUG] Called with to:', to);
    setDraggingWire(currentDraggingWire => {
      console.log('[END WIRE DEBUG] Current draggingWire from state update:', currentDraggingWire);
      if (currentDraggingWire && currentDraggingWire.from !== to) {
        console.log('[END WIRE DEBUG] Creating new wire from', currentDraggingWire.from, 'to', to);
        // More varied wire colors
        const colors = [
          '#FF6B6B', // Red
          '#4ECDC4', // Teal
          '#45B7D1', // Blue
          '#96CEB4', // Mint
          '#FFEAA7', // Yellow
          '#DDA0DD', // Plum
          '#98D8C8', // Seafoam
          '#F7DC6F', // Gold
          '#BB8FCE', // Lavender
          '#85C1E9', // Sky Blue
          '#F8C471', // Orange
          '#82E0AA', // Light Green
          '#F1948A', // Salmon
          '#85C1E9', // Light Blue
          '#FAD7A0', // Peach
        ];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        setWires(wires => [...wires, { from: currentDraggingWire.from, to, color: randomColor }]);
      } else {
        console.log('[END WIRE DEBUG] Not creating wire - same socket or no dragging wire');
      }
      return null;
    });
  };
  const cancelWire = () => setDraggingWire(null);

  // --- Provide context ---
  const wireContextValue: WireContextType = {
    wires,
    startWire,
    updateWire,
    endWire,
    cancelWire,
    draggingWire,
    containerRef,
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
    <WireContext.Provider value={wireContextValue}>
      <div className={styles.workspace}>
        <div className={styles.modulesContainer} ref={containerRef} style={{ position: 'relative' }}>
          <WireOverlay wires={wires} draggingWire={draggingWire} />
          {loadedModules.map(renderModule)}
          <div className={styles.selectorModule}>
            <Module_Selector onModuleSelect={handleModuleSelect} />
          </div>
        </div>
      </div>
    </WireContext.Provider>
  );
};

export default Workspace; 