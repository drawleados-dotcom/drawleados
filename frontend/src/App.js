import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from './components/ui/sonner';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import LeadsPageV2 from './pages/LeadsPageV2';
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
import WebsiteProjectsPage from './pages/WebsiteProjectsPage';
import SocialMediaPage from './pages/SocialMediaPage';
import CreativeDesignBoard from './pages/CreativeDesignBoard';
import MetaAdsBoard from './pages/Operations/MetaAdsBoard';
import DocumentationsPage from './pages/DocumentationsPage';
import SEOBoardPage from './pages/SEOBoardPage';
import AdminSignupPage from './pages/AdminSignupPage';
import ProfilePage from './pages/ProfilePage';
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
      <Route
        path="/website-projects"
        element={
          <ProtectedRoute>
            <WebsiteProjectsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/social-media"
        element={
          <ProtectedRoute>
            <SocialMediaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/creative-board"
        element={
          <ProtectedRoute>
            <CreativeDesignBoard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meta-ads"
        element={
          <ProtectedRoute>
            <MetaAdsBoard />
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
        path="/seo-board"
        element={
          <ProtectedRoute>
            <SEOBoardPage />
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
