import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/auth.service';
import { tokenStore } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(tokenStore.hasSession());
  // What the server offers on the login screen (Google button, e-mail verification, sign-up)
  const [authConfig, setAuthConfig] = useState({ google: false, emailVerification: false, registration: false });

  // Restore the session when the app loads: the API layer gets a new access token from the cookie
  useEffect(() => {
    authService.config().then(setAuthConfig).catch(() => {});
    if (!tokenStore.hasSession()) return;
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
    clearSession();
    await authService.logout().catch(() => {});
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

  /** A login can start a session, ask for the e-mail code, or ask for the authenticator code. */
  const handleAuthResult = useCallback(
    (result) => {
      if (result.verificationRequired || result.twoFactorRequired) return result;
      startSession(result);
      return {};
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
      loginTwoFactor: async (data) => startSession(await authService.loginTwoFactor(data)),
      register: async (details) => handleAuthResult(await authService.register(details)),
      verifyEmail: async (data) => startSession(await authService.verifyEmail(data)),
      resetPassword: async (data) => handleAuthResult(await authService.resetPassword(data)),
      startSession,
      logout,
      setUser,
    }),
    [user, loading, authConfig, handleAuthResult, startSession, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
