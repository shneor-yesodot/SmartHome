import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from './ProtectedRoute';
import AppLayout from '../components/layout/AppLayout';
import { PageLoader } from '../components/ui/States';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Dashboard from '../pages/Dashboard';
import NotFound from '../pages/NotFound';
import VerifyEmail from '../pages/VerifyEmail';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import OAuthCallback from '../pages/OAuthCallback';

// Secondary screens are loaded on demand to keep the first load small
const Transactions = lazy(() => import('../pages/Transactions'));
const Cards = lazy(() => import('../pages/Cards'));
const Reports = lazy(() => import('../pages/Reports'));
const Plan = lazy(() => import('../pages/Plan'));
const Receipts = lazy(() => import('../pages/Receipts'));
const Settings = lazy(() => import('../pages/Settings'));

export default function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>

        {/* Reachable whether or not someone is logged in */}
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/oauth-callback" element={<OAuthCallback />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/cards" element={<Cards />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/receipts" element={<Receipts />} />
            {/* Addresses of the screens that became tabs, for old bookmarks */}
            <Route path="/budgets" element={<Navigate to="/plan" replace />} />
            <Route path="/recurring" element={<Navigate to="/plan?tab=recurring" replace />} />
            <Route path="/maaser" element={<Navigate to="/plan?tab=maaser" replace />} />
            <Route path="/goals" element={<Navigate to="/plan?tab=goals" replace />} />
            <Route path="/products" element={<Navigate to="/receipts?tab=products" replace />} />
            <Route path="/my-receipts" element={<Navigate to="/receipts" replace />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
