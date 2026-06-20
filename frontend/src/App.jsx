import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AuthVerifyPage from './pages/AuthVerifyPage';
import DashboardLayout from './pages/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import SessionsPage from './pages/SessionsPage';
import NewSessionPage from './pages/NewSessionPage';
import SessionWorkspacePage from './pages/SessionWorkspacePage';
import SmartAnalyzerPage from './pages/SmartAnalyzerPage';
import SettingsPage from './pages/SettingsPage';
import ProtectedRoute from './components/ProtectedRoute';
import FraudDetectionPage from './pages/FraudDetectionPage';

import JobsTrendsPage from './pages/JobsTrendsPage';
import JobSeekerSafetyPage from './pages/JobSeekerSafetyPage';

// Developer Portal imports
import DeveloperLandingPage from './pages/developer/DeveloperLandingPage';
import DeveloperLoginPage from './pages/developer/DeveloperLoginPage';
import DeveloperRegisterPage from './pages/developer/DeveloperRegisterPage';
import DeveloperPortalLayout from './pages/developer/DeveloperPortalLayout';
import DeveloperDashboard from './pages/developer/DeveloperDashboard';
import DeveloperKeys from './pages/developer/DeveloperKeys';
import DeveloperUsage from './pages/developer/DeveloperUsage';
import DeveloperBilling from './pages/developer/DeveloperBilling';
import DeveloperWebhooks from './pages/developer/DeveloperWebhooks';
import DeveloperEmbed from './pages/developer/DeveloperEmbed';
import DeveloperDocs from './pages/developer/DeveloperDocs';
import DeveloperSettings from './pages/developer/DeveloperSettings';

// Job Seeker Portal imports
import JobSeekerLoginPage from './pages/seeker/JobSeekerLoginPage';
import JobSeekerRegisterPage from './pages/seeker/JobSeekerRegisterPage';

// New Workly-style Job Seeker Portal Pages
import UserHome from './pages/user/UserHome';
import UserJobs from './pages/user/UserJobs';
import UserJobDetail from './pages/user/UserJobDetail';
import UserCompanies from './pages/user/UserCompanies';
import UserCompanyDetail from './pages/user/UserCompanyDetail';
import UserProfile from './pages/user/UserProfile';
import UserDashboard from './pages/user/UserDashboard';
import UserUploadResume from './pages/user/UserUploadResume';
import UserApply from './pages/user/UserApply';
import UserApplications from './pages/user/UserApplications';

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    // Scroll immediately
    window.scrollTo(0, 0);
    document.documentElement.scrollTo(0, 0);
    document.body.scrollTo(0, 0);

    // Also scroll on subsequent rendering frames/ticks to handle layout shifts & delayed renders
    const handleScroll = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTo(0, 0);
      document.body.scrollTo(0, 0);
    };

    const rafId = requestAnimationFrame(handleScroll);
    const t1 = setTimeout(handleScroll, 20);
    const t2 = setTimeout(handleScroll, 100);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [location.pathname, location.key]);

  return null;
}

export default function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,      // 5 min
        gcTime: 10 * 60 * 1000,         // 10 min garbage collection
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      }
    }
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster 
        position="top-right"
        gutter={8}
        toastOptions={{
          duration: 4000,
          style: {
            background:"white",
            color:"#2A2A2A",
            borderLeft:"4px solid #2563EB",
            borderRadius:"8px",
            boxShadow:"0 4px 12px rgba(0,0,0,0.1)"
          },
          success: {
            iconTheme:{primary:"#22C55E",secondary:"white"}
          },
          error: {
            iconTheme:{primary:"#EF4444",secondary:"white"}
          }
        }}
      />
      <Router>
        <ScrollToTop />
        <Routes>
           {/* Seeker Portal Routes (Workly-style) */}
          <Route path="/" element={<UserHome />} />
          <Route path="/jobs" element={<UserJobs />} />
          <Route path="/jobs/:jobId" element={<UserJobDetail />} />
          <Route path="/companies" element={<UserCompanies />} />
          <Route path="/companies/:companyId" element={<UserCompanyDetail />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/dashboard" element={<UserDashboard />} />
          <Route path="/upload-resume" element={<UserUploadResume />} />
          <Route path="/apply/:jobId" element={<UserApply />} />
          <Route path="/applications" element={<UserApplications />} />

          {/* Additional Seeker Pages (wrapped or trends) */}
          <Route path="/market-trends" element={<JobsTrendsPage />} />
          <Route path="/hiring-safety" element={<JobSeekerSafetyPage />} />

          {/* Job Seeker Portal — Auth */}
          <Route path="/jobs/login"    element={<JobSeekerLoginPage />} />
          <Route path="/jobs/register" element={<JobSeekerRegisterPage />} />
          <Route path="/auth/register" element={<JobSeekerRegisterPage />} />
          <Route path="/auth/login"    element={<Navigate to="/jobs/login" replace />} />

          {/* Recruiter / Company Public Routes (all under /admin/*) */}
          <Route path="/admin" element={<LandingPage />} />
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin/register" element={<RegisterPage />} />
          <Route path="/admin/auth/verify" element={<AuthVerifyPage />} />

          {/* Recruiter / Company Sidebar/Portal Redirects */}
          <Route path="/admin/pricing" element={<Navigate to="/admin" replace />} />
          <Route path="/admin/features" element={<Navigate to="/admin" replace />} />
          <Route path="/admin/developers" element={<Navigate to="/developer" replace />} />
          <Route path="/admin/jobs/post" element={<Navigate to="/admin/dashboard/sessions/new" replace />} />
          <Route path="/admin/applications" element={<Navigate to="/admin/dashboard/sessions" replace />} />

          {/* Backward-compat redirects for old routes */}
          <Route path="/login" element={<Navigate to="/admin/login" replace />} />
          <Route path="/register" element={<Navigate to="/admin/register" replace />} />
          <Route path="/auth/verify" element={<Navigate to="/admin/auth/verify" replace />} />

          {/* Developer Portal Routes */}
          <Route path="/developer" element={<DeveloperLandingPage />} />
          <Route path="/developer/login" element={<DeveloperLoginPage />} />
          <Route path="/developer/register" element={<DeveloperRegisterPage />} />
          
          <Route path="/developer/portal" element={
            <DeveloperPortalLayout />
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DeveloperDashboard />} />
            <Route path="keys" element={<DeveloperKeys />} />
            <Route path="usage" element={<DeveloperUsage />} />
            <Route path="billing" element={<DeveloperBilling />} />
            <Route path="webhooks" element={<DeveloperWebhooks />} />
            <Route path="embed" element={<DeveloperEmbed />} />
            <Route path="docs" element={<DeveloperDocs />} />
            <Route path="settings" element={<DeveloperSettings />} />
          </Route>

          {/* Protected Recruiter Dashboard Routes (moved to /admin/dashboard) */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<DashboardHome />} />
            <Route path="sessions" element={<SessionsPage />} />
            <Route path="sessions/new" element={<NewSessionPage />} />
            <Route path="sessions/:id" element={<SessionWorkspacePage />} />
            <Route path="smart-analyzer" element={<SmartAnalyzerPage />} />
            <Route path="protection" element={<FraudDetectionPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}
