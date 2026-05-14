import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import AppShell from './components/layout/AppShell';
import AuthPage from './pages/AuthPage';

// Lazy-load heavy pages for better initial load
const BoardPage = lazy(() => import('./pages/BoardPage'));
const BacklogPage = lazy(() => import('./pages/BacklogPage'));
const SprintsPage = lazy(() => import('./pages/SprintsPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const GanttPage = lazy(() => import('./pages/GanttPage'));
const WorkloadPage = lazy(() => import('./pages/WorkloadPage'));
const ActivityPage = lazy(() => import('./pages/ActivityPage'));
const AutomationsPage = lazy(() => import('./pages/AutomationsPage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const CustomFieldsPage = lazy(() => import('./pages/CustomFieldsPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sidebar">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-xl">M</span>
          </div>
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/board" replace />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/backlog" element={<BacklogPage />} />
          <Route path="/sprints" element={<SprintsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/gantt" element={<GanttPage />} />
          <Route path="/workload" element={<WorkloadPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/automations" element={<AutomationsPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/custom-fields" element={<CustomFieldsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="*" element={<Navigate to="/board" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
