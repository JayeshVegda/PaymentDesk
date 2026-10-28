import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import AppLayout from '../components/shell/AppLayout';
import TodayPage from '../pages/TodayPage';

const LedgerPage = lazy(() => import('../pages/LedgerPage'));
const PayeesPage = lazy(() => import('../pages/PayeesPage'));
const PayeeDetailPage = lazy(() => import('../pages/PayeeDetailPage'));
const ActivityPage = lazy(() => import('../pages/ActivityPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const SystemPage = lazy(() => import('../pages/SystemPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const ExportPage = lazy(() => import('../pages/ExportPage'));

function RouteFallback() {
  return (
    <div className="grid grid-cols-3 gap-3" role="status" aria-label="Loading page">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-32 animate-pulse rounded-2xl bg-white" />
      ))}
    </div>
  );
}

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<TodayPage />} />
        <Route
          path="/ledger"
          element={
            <Suspense fallback={<RouteFallback />}>
              <LedgerPage />
            </Suspense>
          }
        />
        <Route
          path="/ledger/:transactionId"
          element={
            <Suspense fallback={<RouteFallback />}>
              <LedgerPage />
            </Suspense>
          }
        />
        <Route
          path="/review"
          element={
            <Suspense fallback={<RouteFallback />}>
              <LedgerPage />
            </Suspense>
          }
        />
        <Route
          path="/payees"
          element={
            <Suspense fallback={<RouteFallback />}>
              <PayeesPage />
            </Suspense>
          }
        />
        <Route
          path="/payees/:payeeId"
          element={
            <Suspense fallback={<RouteFallback />}>
              <PayeeDetailPage />
            </Suspense>
          }
        />
        <Route
          path="/activity"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ActivityPage />
            </Suspense>
          }
        />
        <Route
          path="/reports"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ReportsPage />
            </Suspense>
          }
        />
        <Route
          path="/system"
          element={
            <Suspense fallback={<RouteFallback />}>
              <SystemPage />
            </Suspense>
          }
        />
        <Route
          path="/settings"
          element={
            <Suspense fallback={<RouteFallback />}>
              <SettingsPage />
            </Suspense>
          }
        />
        <Route
          path="/export"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ExportPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
