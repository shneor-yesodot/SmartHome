import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
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
const Products = lazy(() => import('../pages/Products'));
const Reports = lazy(() => import('../pages/Reports'));
const Budgets = lazy(() => import('../pages/Budgets'));
const Goals = lazy(() => import('../pages/Goals'));
const Recurring = lazy(() => import('../pages/Recurring'));
const UploadReceipt = lazy(() => import('../pages/UploadReceipt'));
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
            <Route path="/products" element={<Products />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/recurring" element={<Recurring />} />
            <Route path="/receipts" element={<UploadReceipt />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
