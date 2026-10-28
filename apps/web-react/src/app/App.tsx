import React from 'react';
import { BrowserRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './query-client';
import AppRouter from './router';
import { Toaster } from 'sonner';
import { AppErrorBoundary } from '../components/common/AppErrorBoundary';

export default function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppRouter />
          <Toaster richColors position="top-right" />
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
