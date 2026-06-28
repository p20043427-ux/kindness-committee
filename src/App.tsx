/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Monitoring } from "./pages/Monitoring";
import { Management } from "./pages/Management";
import { Admin } from "./pages/Admin";
import { YearlyReport } from "./pages/YearlyReport";
import { DataManagement } from "./pages/DataManagement";
import { Committee } from "./pages/Committee";
import { Schedule } from "./pages/Schedule";
import { Events } from "./pages/Events";
import { AuthProvider, useAuth } from "./components/auth/AuthProvider";
import { OrganizationProvider } from "./components/layout/OrganizationProvider";
import { SettingsProvider } from "./components/layout/SettingsProvider";
import { ToastProvider } from "./components/ui/Toast";

function AppRoutes() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-surface-500">
        <div className="w-10 h-10 border-4 border-surface-200 border-t-primary-600 rounded-full animate-spin" role="status" aria-label="로딩 중" />
        <span className="text-sm font-medium">시스템 연결 중...</span>
      </div>
    );
  }

  return (
    <OrganizationProvider>
      <SettingsProvider>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="monitoring" element={<Monitoring />} />
          <Route path="data-management" element={<DataManagement />} />
          <Route path="committee" element={<Committee />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="events" element={<Events />} />
          <Route path="management" element={<Management />} />
          <Route path="yearly-report" element={<YearlyReport />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
      </SettingsProvider>
    </OrganizationProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
