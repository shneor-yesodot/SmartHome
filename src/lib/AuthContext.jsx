import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { api } from '@/api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const checkUserAuth = useCallback(async () => {
    if (!api.auth.isAuthenticated()) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return;
    }
    setIsLoadingAuth(true);
    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    api.auth.logout('/login');
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authChecked,
      logout,
      checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
