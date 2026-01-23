
import React, { lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

/*
  Lazy loading of all page components to optimize performance.
*/
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const OperationManagement = lazy(() => import('./pages/OperationManagement'));
const PilotManagement = lazy(() => import('./pages/PilotManagement'));
const DroneManagement = lazy(() => import('./pages/DroneManagement'));
const MaintenanceManagement = lazy(() => import('./pages/MaintenanceManagement'));
const Reports = lazy(() => import('./pages/Reports'));
const Transmissions = lazy(() => import('./pages/Transmissions'));
const SummerOperationCenter = lazy(() => import('./pages/SummerOperationCenter'));
const FlightPlan = lazy(() => import('./pages/FlightPlan'));
const Aro = lazy(() => import('./pages/Aro'));
const SystemAudit = lazy(() => import('./pages/SystemAudit'));
const DatabaseUpdates = lazy(() => import('./pages/DatabaseUpdates'));
const CautelaManagement = lazy(() => import('./pages/CautelaManagement'));

// TACTICAL MAP ONLY
const TacticalMapPage = lazy(() => import('./pages/TacticalOperationCenter'));

/*
  The main App component handles application-wide routing and lazy loading boundaries.
*/
export default function App() {
  return (
    <Router>
      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-medium">Carregando SYSARP...</div>}>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Private Routes wrapped in Layout */}
          <Route path="/" element={<Layout><Dashboard /></Layout>} />
          <Route path="/operations" element={<Layout><OperationManagement /></Layout>} />
          
          {/* LEVEL 2: TACTICAL MAP (Execution - Now the Main Map) */}
          <Route path="/operations/:id/gerenciar" element={<TacticalMapPage />} />
          {/* Backward compatibility redirect if user tries old URL */}
          <Route path="/operations/:id/tactical" element={<Navigate to="../gerenciar" relative="path" replace />} />

          <Route path="/pilots" element={<Layout><PilotManagement /></Layout>} />
          <Route path="/drones" element={<Layout><DroneManagement /></Layout>} />
          <Route path="/maintenance" element={<Layout><MaintenanceManagement /></Layout>} />
          <Route path="/reports" element={<Layout><Reports /></Layout>} />
          <Route path="/transmissions" element={<Layout><Transmissions /></Layout>} />
          
          {/* Unified Summer Op Route */}
          <Route path="/summer" element={<Layout><SummerOperationCenter /></Layout>} />
          
          <Route path="/flight-plan" element={<Layout><FlightPlan /></Layout>} />
          <Route path="/aro" element={<Layout><Aro /></Layout>} />
          <Route path="/audit" element={<Layout><SystemAudit /></Layout>} />
          <Route path="/db-updates" element={<Layout><DatabaseUpdates /></Layout>} />
          <Route path="/cautela" element={<Layout><CautelaManagement /></Layout>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
