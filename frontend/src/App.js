import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from './components/ui/sonner';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import LeadsPageV2 from './pages/LeadsPageV2';
import FinancePage from './pages/FinancePage';
import FinanceModule from './pages/FinanceModule';
import ServicesPage from './pages/ServicesPage';
import OperationsPage from './pages/OperationsPage';
import SettingsPage from './pages/SettingsPage';
import HRPage from './pages/HRPage';
import HRAdminPage from './pages/HRAdminPage';
import MarketingModule from './pages/MarketingModule';
import SOPWorksBoard from './pages/SOPWorksBoard';
import DocumentationsPage from './pages/DocumentationsPage';
import AdminSignupPage from './pages/AdminSignupPage';
import ProfilePage from './pages/ProfilePage';
import OurTasksPage from './pages/OurTasksPage';
import CalendarDayDetailPage from './pages/CalendarDayDetailPage';
import CalendarPage from './pages/CalendarPage';
import LeaveVerificationPage from './pages/LeaveVerificationPage';
import MyDocumentsPage from './pages/MyDocumentsPage';
import DLOperationsPage from './pages/DLOperationsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ApprovalsPage from './pages/ApprovalsPage';
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
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/admin" element={<AdminSignupPage />} />
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
            <LeadsPageV2 />
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
        path="/calendar/:date"
        element={
          <ProtectedRoute>
            <CalendarDayDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave-verification"
        element={
          <ProtectedRoute>
            <LeaveVerificationPage />
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
      {/* Legacy redirects → Web Dev */}
      <Route path="/website-projects" element={<Navigate to="/dl-operations" replace />} />
      <Route path="/social-media" element={<Navigate to="/dl-operations" replace />} />
      <Route path="/creative-board" element={<Navigate to="/dl-operations" replace />} />
      <Route path="/meta-ads" element={<Navigate to="/dl-operations" replace />} />
      <Route path="/seo-board" element={<Navigate to="/dl-operations" replace />} />
      <Route path="/bde-tasks" element={<Navigate to="/operations" replace />} />
      <Route path="/tasks" element={<Navigate to="/operations" replace />} />
      <Route path="/my-tasks" element={<Navigate to="/operations" replace />} />
      <Route path="/reports" element={<Navigate to="/leads" replace />} />
      <Route
        path="/dl-operations"
        element={
          <ProtectedRoute>
            <DLOperationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId"
        element={
          <ProtectedRoute>
            <ProjectDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/approvals"
        element={
          <ProtectedRoute>
            <ApprovalsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/documentations"
        element={
          <ProtectedRoute>
            <DocumentationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/our-tasks"
        element={
          <ProtectedRoute>
            <OurTasksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-documents"
        element={
          <ProtectedRoute>
            <MyDocumentsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/leads" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRouter />
          <Toaster
            position="top-right"
            closeButton={true}
            toastOptions={{
              style: {
                background: 'var(--toast-bg, #18181b)',
                color: 'var(--toast-text, #fafafa)',
                border: '1px solid var(--toast-border, #27272a)',
              },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
