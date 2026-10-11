import api, { unwrap } from './api';

export const authService = {
  config: () => unwrap(api.get('/auth/config')),
  login: (credentials) => unwrap(api.post('/auth/login', credentials)),
  register: (details) => unwrap(api.post('/auth/register', details)),
  verifyEmail: (data) => unwrap(api.post('/auth/verify-email', data)),
  resendCode: (email) => unwrap(api.post('/auth/resend-code', { email })),
  forgotPassword: (email) => unwrap(api.post('/auth/forgot-password', { email })),
  resetPassword: (data) => unwrap(api.post('/auth/reset-password', data)),
  logout: (refreshToken) => unwrap(api.post('/auth/logout', { refreshToken })),
  me: () => unwrap(api.get('/auth/me')),
  updateProfile: (data) => unwrap(api.patch('/auth/me', data)),
  changePassword: (data) => unwrap(api.put('/auth/password', data)),
  /** Full-page redirect: Google sign-in is a round trip through Google's servers. */
  googleUrl: (returnTo = '/') =>
    `${import.meta.env.VITE_API_URL || '/api'}/auth/google?returnTo=${encodeURIComponent(returnTo)}`,
};
