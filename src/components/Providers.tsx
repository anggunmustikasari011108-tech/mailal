'use client';

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { StoreProvider } from '../context/StoreContext';

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary>
      <StoreProvider>{children}</StoreProvider>
    </ErrorBoundary>
  );
};
