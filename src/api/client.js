const API_BASE = import.meta.env.VITE_API_URL || '/api';
const ACCESS_KEY = 'smarthome_access_token';
const REFRESH_KEY = 'smarthome_refresh_token';

export function getToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function setTokens(access, refresh) {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function parseBody(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

let refreshing = null;

// Exchanges the stored refresh token for a new token pair. Concurrent 401s share one request.
function tryRefresh() {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return Promise.resolve(false);
  if (!refreshing) {
    refreshing = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
      .then(async (res) => {
        const body = await parseBody(res);
        if (!res.ok) {
          clearTokens();
          return false;
        }
        setTokens(body.data.access_token, body.data.refresh_token);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function request(path, options = {}, retry = true) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && retry && (await tryRefresh())) {
    return request(path, options, false);
  }

  const body = await parseBody(res);
  if (!res.ok) {
    const message = body?.error?.message || 'הבקשה נכשלה';
    throw new ApiError(message, res.status, body);
  }
  return body?.data;
}

const json = (method, payload) => ({ method, body: JSON.stringify(payload) });

function entity(basePath) {
  return {
    list: (sort, limit) => {
      const q = new URLSearchParams();
      if (sort) q.set('sort', sort);
      if (limit) q.set('limit', String(limit));
      const qs = q.toString();
      return request(qs ? `${basePath}?${qs}` : basePath);
    },
    get: (id) => request(`${basePath}/${id}`),
    create: (payload) => request(basePath, json('POST', payload)),
    update: (id, payload) => request(`${basePath}/${id}`, json('PUT', payload)),
    delete: (id) => request(`${basePath}/${id}`, { method: 'DELETE' }),
    bulkCreate: (items) => request(`${basePath}/bulk`, json('POST', { items })),
  };
}

async function withTokens(promise) {
  const data = await promise;
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export const api = {
  auth: {
    me: () => request('/auth/me'),
    isAuthenticated: () => Boolean(getToken() || localStorage.getItem(REFRESH_KEY)),
    login: (email, password) => withTokens(request('/auth/login', json('POST', { email, password }))),
    register: ({ email, password }) => request('/auth/register', json('POST', { email, password })),
    verifyOtp: ({ email, otpCode }) => withTokens(request('/auth/verify-otp', json('POST', { email, otpCode }))),
    resendOtp: (email) => request('/auth/resend-otp', json('POST', { email })),
    forgotPassword: (email) => request('/auth/forgot-password', json('POST', { email })),
    resetPassword: ({ resetToken, newPassword }) =>
      request('/auth/reset-password', json('POST', { resetToken, newPassword })),
    loginWithGoogle: (returnTo = '/') => {
      window.location.href = `${API_BASE}/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
    },
    logout: async (redirectTo) => {
      try {
        await request('/auth/logout', json('POST', { refresh_token: localStorage.getItem(REFRESH_KEY) }));
      } catch {
        /* the session is cleared locally either way */
      }
      clearTokens();
      if (redirectTo) window.location.href = redirectTo;
    },
  },
  entities: {
    Transaction: entity('/transactions'),
    Category: entity('/categories'),
    Budget: entity('/budgets'),
    RecurringPayment: entity('/recurring'),
  },
  files: {
    /** Uploads a file and returns { file_url, file_name }. */
    upload: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return request('/upload', { method: 'POST', body: fd });
    },
    /** Runs AI analysis on an uploaded receipt image: { merchant, date, total, items[] }. */
    analyzeReceipt: (file_url) => request('/upload/analyze-receipt', json('POST', { file_url })),
    /** Parses an uploaded Excel/CSV file: { transactions[] }. */
    extractTransactions: (file_url) => request('/upload/extract-excel', json('POST', { file_url })),
  },
};
