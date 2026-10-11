import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/auth.service';
import { tokenStore } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get() || tokenStore.getRefresh()));
  // What the server offers on the login screen (Google button, e-mail verification)
  const [authConfig, setAuthConfig] = useState({ google: false, emailVerification: false });

  // Restore the session when the app loads (an expired access token is refreshed by the API layer)
  useEffect(() => {
    authService.config().then(setAuthConfig).catch(() => {});
    if (!tokenStore.get() && !tokenStore.getRefresh()) return;
    authService
      .me()
      .then((data) => setUser(data.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  /** Revokes the refresh token on the server too, so it cannot be reused. */
  const logout = useCallback(async () => {
    const refreshToken = tokenStore.getRefresh();
    clearSession();
    if (refreshToken) await authService.logout(refreshToken).catch(() => {});
  }, [clearSession]);

  // The API layer fires this event when the session cannot be renewed
  useEffect(() => {
    window.addEventListener('auth:expired', clearSession);
    return () => window.removeEventListener('auth:expired', clearSession);
  }, [clearSession]);

  const startSession = useCallback((session) => {
    tokenStore.set(session);
    setUser(session.user);
  }, []);

  /** Login and register either start a session or ask for the e-mail verification code. */
  const handleAuthResult = useCallback(
    (result) => {
      if (result.verificationRequired) return result;
      startSession(result);
      return { verificationRequired: false };
    },
    [startSession]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      authConfig,
      isAuthenticated: Boolean(user),
      login: async (credentials) => handleAuthResult(await authService.login(credentials)),
      register: async (details) => handleAuthResult(await authService.register(details)),
      verifyEmail: async (data) => startSession(await authService.verifyEmail(data)),
      resetPassword: async (data) => startSession(await authService.resetPassword(data)),
      startSession,
      logout,
      setUser,
    }),
    [user, loading, authConfig, handleAuthResult, startSession, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
