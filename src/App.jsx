import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import OAuthCallback from '@/pages/OAuthCallback';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Transactions from '@/pages/Transactions';
import Budgets from '@/pages/Budgets';
import Recurring from '@/pages/Recurring';
import UploadReceipt from '@/pages/UploadReceipt';
import Settings from '@/pages/Settings';
import Reports from '@/pages/Reports';

// Sends signed-out users to /login, remembering where they were headed.
const RedirectToLogin = () => {
  const location = useLocation();
  const path = location.pathname + location.search;
  const target = path === '/' ? '/login' : `/login?returnTo=${encodeURIComponent(path)}`;
  return <Navigate to={target} replace />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/oauth-callback" element={<OAuthCallback />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<RedirectToLogin />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/recurring" element={<Recurring />} />
          <Route path="/upload" element={<UploadReceipt />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AppRoutes />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App