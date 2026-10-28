import React from 'react';
import { Routes, Route, Navigate } from 'react-router';
import AppLayout from '../components/shell/AppLayout';
import TodayPage from '../pages/TodayPage';
import LedgerPage from '../pages/LedgerPage';
import PayeesPage from '../pages/PayeesPage';
import PayeeDetailPage from '../pages/PayeeDetailPage';
import ActivityPage from '../pages/ActivityPage';
import ReportsPage from '../pages/ReportsPage';
import SystemPage from '../pages/SystemPage';
import ExportPage from '../pages/ExportPage';

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<TodayPage />} />
        <Route path="/ledger" element={<LedgerPage />} />
        <Route path="/ledger/:transactionId" element={<LedgerPage />} />
        <Route path="/review" element={<LedgerPage />} />
        <Route path="/payees" element={<PayeesPage />} />
        <Route path="/payees/:payeeId" element={<PayeeDetailPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/system" element={<SystemPage />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
