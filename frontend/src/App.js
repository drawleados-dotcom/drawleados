import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import LeadsPage from './pages/LeadsPage';
import ReportsPage from './pages/ReportsPage';
import FinancePage from './pages/FinancePage';
import FinanceModule from './pages/FinanceModule';
import ServicesPage from './pages/ServicesPage';
import OperationsPage from './pages/OperationsPage';
import SettingsPage from './pages/SettingsPage';
import HRPage from './pages/HRPage';
import HRAdminPage from './pages/HRAdminPage';
import MarketingModule from './pages/MarketingModule';
import SOPWorksBoard from './pages/SOPWorksBoard';
import './App.css';

function AppRouter() {
  const location = useLocation();

  // Check URL fragment synchronously during render (prevents race conditions)
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <LeadsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/finance"
        element={
          <ProtectedRoute>
            <FinanceModule />
          </ProtectedRoute>
        }
      />
      <Route
        path="/services"
        element={
          <ProtectedRoute>
            <ServicesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operations"
        element={
          <ProtectedRoute>
            <OperationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr"
        element={
          <ProtectedRoute>
            <HRPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr-admin"
        element={
          <ProtectedRoute>
            <HRAdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/marketing"
        element={
          <ProtectedRoute>
            <MarketingModule />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sop-works"
        element={
          <ProtectedRoute>
            <SOPWorksBoard />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#18181b',
              color: '#fafafa',
              border: '1px solid #27272a',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
