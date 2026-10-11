import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/ui/States';

/** Lets only logged-in users through; everyone else goes to the login screen. */
export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="מתחברים" />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Login / register screens are hidden from users who are already logged in. */
export function GuestRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader label="מתחברים" />;
  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
}
