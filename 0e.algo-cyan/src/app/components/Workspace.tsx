'use client';

import React, { useState, useRef, useLayoutEffect } from 'react';
import Module_Selector from './modules/Module_Selector';
import Module_ExchangeDataSource from './modules/Module_ExchangeDataSource';
import Module_FileDataSource from './modules/Module_FileDataSource';
import Module_MarketDepthHistogram from './modules/Module_MarketDepthHistogram';
import Module_OrderBook from './modules/Module_OrderBook';
import Module_Experiment from './modules/Module_Experiment';
import styles from './Workspace.module.css';
import { getCatenaryCurve } from 'catenary-curve';

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
  droopFactor: number; // random multiplier for wire length
  wireId: number;
}

// Configurable minimum droop (in px)
const WIRE_MIN_DROOP_PX = 50; // TODO: Make this configurable via UI if needed
const WIRE_DEFAULT_LENGTH_MULTIPLE = 1.25; // Wire is at least 1.25x the straight-line distance

interface WireContextType {
  wires: Wire[];
  startWire: (from: string, startPos: { x: number; y: number }) => void;
  updateWire: (pos: { x: number; y: number }) => void;
  endWire: (to: string) => void;
  cancelWire: () => void;
  draggingWire: null | { from: string; startPos: { x: number; y: number }; currentPos: { x: number; y: number }; sessionId?: number };
  containerRef: React.RefObject<HTMLDivElement | null>;
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

  // Overload makePath to accept an optional droopFactor
  const makePath = (a: { x: number; y: number }, b: { x: number; y: number }, droopFactor?: number) => {
    // Use catenary-curve for realistic wire droop
    const x1 = a.x, y1 = a.y;
    const x2 = b.x, y2 = b.y;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const straightDist = Math.sqrt(dx * dx + dy * dy);
    // Use the provided droopFactor or default
    const factor = droopFactor ?? WIRE_DEFAULT_LENGTH_MULTIPLE;
    const wireLength = Math.max(factor * straightDist, straightDist + 2 * WIRE_MIN_DROOP_PX);
    const result = getCatenaryCurve(
      { x: x1, y: y1 },
      { x: x2, y: y2 },
      wireLength,
      { segments: 25 }
    );
    if (result.type === 'line') {
      // fallback: straight line
      return `M${x1},${y1} L${x2},${y2}`;
    }
    // result.type === 'quadraticCurve'
    let d = `M${result.start[0]},${result.start[1]}`;
    for (const seg of result.curves) {
      d += ` Q${seg[0]},${seg[1]} ${seg[2]},${seg[3]}`;
    }
    return d;
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
            d={makePath(from, to, wire.droopFactor)} 
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
  const [draggingWire, setDraggingWire] = useState<WireContextType['draggingWire'] & { sessionId?: number } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const wireCreatedRef = useRef(false);
  const wireIdCounter = useRef(1);
  const dragSessionIdRef = useRef(0);
  const draggingWireRef = useRef<WireContextType['draggingWire'] & { sessionId?: number } | null>(null);

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
    dragSessionIdRef.current += 1;
    const sessionId = dragSessionIdRef.current;
    const wire = { from, startPos, currentPos: startPos, sessionId };
    draggingWireRef.current = wire;
    setDraggingWire(wire);
  };
  const updateWire = (pos: { x: number; y: number }) => {
    if (!draggingWireRef.current) return;
    const updated = { ...draggingWireRef.current, currentPos: pos };
    draggingWireRef.current = updated;
    setDraggingWire(updated);
  };
  const endWire = (to: string) => {
    const currentSessionId = dragSessionIdRef.current;
    const currentDraggingWire = draggingWireRef.current;
    if (
      currentDraggingWire &&
      currentDraggingWire.from !== to &&
      currentDraggingWire.sessionId === currentSessionId
    ) {
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
      // Random droop factor between 1.10 and 1.50 (wider range)
      const droopFactor = 1.10 + Math.random() * 0.40;
      const wireId = wireIdCounter.current++;
      setWires(wires => [...wires, { from: currentDraggingWire.from, to, color: randomColor, droopFactor, wireId }]);
    }
    draggingWireRef.current = null;
    setDraggingWire(null);
    setTimeout(() => { wireCreatedRef.current = false; }, 0);
  };
  const cancelWire = () => {
    draggingWireRef.current = null;
    setDraggingWire(null);
  };

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