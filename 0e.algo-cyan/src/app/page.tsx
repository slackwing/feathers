'use client';

import React from 'react';
import { CoinbaseWebSocketProvider } from './providers/CoinbaseWebSocketProvider';
import Workspace from './components/Workspace';

const Dashboard = () => {
  return <Workspace />;
};

export default function Page() {
  return (
    <CoinbaseWebSocketProvider>
      <Dashboard />
    </CoinbaseWebSocketProvider>
  );
}
