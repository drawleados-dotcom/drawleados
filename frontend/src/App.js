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
import OperationsModalPage from './components/operations/OperationsModalPage';
import OrgStructurePage from './pages/OrgStructurePage';
import EmployeeAttendanceViewPage from './pages/EmployeeAttendanceViewPage';
import ClientPortalLoginPage from './pages/ClientPortalLoginPage';
import ClientPortalViewPage from './pages/ClientPortalViewPage';
import ClientMasterPage from './pages/ClientMasterPage';
import ServicePackagesPage from './pages/ServicePackagesPage';
import BNIPage from './pages/BNIPage';
import BNIWeeklyMeetingDetailPage from './pages/BNIWeeklyMeetingDetailPage';
import BNIFuturePresentationFormPage from './pages/BNIFuturePresentationFormPage';
import AutomationPage from './pages/AutomationPage';
import LinkedInPartnershipPage from './pages/LinkedInPartnershipPage';
import LinkedInConnectionsPage from './pages/LinkedInConnectionsPage';
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
      {/* Client Portal — separate auth from staff accounts, no ProtectedRoute */}
      <Route path="/client-portal/:projectId" element={<ClientPortalLoginPage />} />
      <Route path="/client-portal/:projectId/view" element={<ClientPortalViewPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute module="dashboard">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute module="leads">
            <LeadsPageV2 />
          </ProtectedRoute>
        }
      />
      <Route
        path="/finance"
        element={
          <ProtectedRoute module="finance">
            <FinanceModule />
          </ProtectedRoute>
        }
      />
      <Route
        path="/services"
        element={
          <ProtectedRoute module="services">
            <ServicesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operations"
        element={
          <ProtectedRoute module="operations">
            <OperationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute module="settings">
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/client-master"
        element={
          <ProtectedRoute module="client_master">
            <ClientMasterPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/service-packages"
        element={
          <ProtectedRoute module="service_packages">
            <ServicePackagesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bni"
        element={
          <ProtectedRoute module="bni">
            <BNIPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bni/weekly-meeting/:meetingId"
        element={
          <ProtectedRoute module="bni">
            <BNIWeeklyMeetingDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bni/weekly-meeting/:meetingId/future-presentation/:presentationId"
        element={
          <ProtectedRoute module="bni">
            <BNIFuturePresentationFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/linkedin"
        element={
          <ProtectedRoute module="linkedin">
            <LinkedInConnectionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/automation"
        element={
          <ProtectedRoute module="automation">
            <AutomationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/automation/linkedin-partnership"
        element={
          <ProtectedRoute module="automation">
            <LinkedInPartnershipPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr"
        element={
          // No module gate — every authenticated employee gets their own profile.
          <ProtectedRoute>
            <HRPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar/:date"
        element={
          <ProtectedRoute module="calendar">
            <CalendarDayDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute module="calendar">
            <CalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave-verification"
        element={
          <ProtectedRoute module="hr_admin">
            <LeaveVerificationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr-admin"
        element={
          <ProtectedRoute module="hr_admin">
            <HRAdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/marketing"
        element={
          <ProtectedRoute module="marketing">
            <MarketingModule />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sop-works"
        element={
          <ProtectedRoute module="sop_works">
            <SOPWorksBoard />
          </ProtectedRoute>
        }
      />
      {/* Legacy redirects → consolidated modules */}
      <Route path="/website-projects" element={<Navigate to="/dl-operations" replace />} />
      <Route path="/social-media" element={<Navigate to="/dl-operations" replace />} />
      <Route path="/creative-board" element={<Navigate to="/dl-operations" replace />} />
      <Route path="/meta-ads" element={<Navigate to="/dl-operations" replace />} />
      <Route path="/seo-board" element={<Navigate to="/dl-operations" replace />} />
      <Route path="/seo" element={<Navigate to="/dl-operations" replace />} />
      <Route path="/sales" element={<Navigate to="/our-tasks" replace />} />
      <Route path="/sales-tasks" element={<Navigate to="/our-tasks" replace />} />
      <Route path="/bde-tasks" element={<Navigate to="/operations" replace />} />
      <Route path="/tasks" element={<Navigate to="/operations" replace />} />
      <Route path="/my-tasks" element={<Navigate to="/operations" replace />} />
      <Route path="/reports" element={<Navigate to="/our-tasks" replace />} />
      <Route
        path="/dl-operations"
        element={
          <ProtectedRoute module="web_dev">
            <DLOperationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId"
        element={
          <ProtectedRoute module="web_dev">
            <ProjectDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/approvals"
        element={
          <ProtectedRoute module="our_tasks">
            <OperationsModalPage defaultTab="approvals" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/org-structure"
        element={
          <ProtectedRoute module="hr_admin">
            <OrgStructurePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr-admin/attendance/:userId"
        element={
          <ProtectedRoute module="hr_admin">
            <EmployeeAttendanceViewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/documentations"
        element={
          // No module gate — every authenticated employee gets the documentation module.
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
      <Route path="/" element={<Navigate to="/our-tasks" replace />} />
      {/* Catch-all: unknown routes redirect to landing instead of rendering a blank shell */}
      <Route path="*" element={<Navigate to="/our-tasks" replace />} />
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
