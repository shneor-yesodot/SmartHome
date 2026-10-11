import axios from 'axios';

const ACCESS_KEY = 'smarthome_token';
const REFRESH_KEY = 'smarthome_refresh_token';

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const tokenStore = {
  get: () => read(ACCESS_KEY),
  getRefresh: () => read(REFRESH_KEY),
  set: ({ token, refreshToken }) => {
    localStorage.setItem(ACCESS_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

const baseURL = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({ baseURL, timeout: 90000 });

// Attach the access token to every request
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Calls where a 401 means "wrong details", not "session expired"
const PUBLIC_AUTH_CALLS = ['/auth/login', '/auth/register', '/auth/verify-email', '/auth/reset-password', '/auth/refresh', '/auth/logout'];
const isPublicAuthCall = (url = '') => PUBLIC_AUTH_CALLS.some((path) => url.startsWith(path));

/**
 * One refresh at a time: requests that fail together wait for the same
 * refresh. If another tab refreshed first, its new tokens are used instead.
 */
let refreshing = null;
const refreshSession = () => {
  if (!refreshing) {
    const refreshToken = tokenStore.getRefresh();
    refreshing = (async () => {
      if (!refreshToken) return false;
      try {
        const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken }, { timeout: 15000 });
        tokenStore.set(data.data);
        return true;
      } catch {
        const current = tokenStore.getRefresh();
        return Boolean(current && current !== refreshToken);
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
};

const toError = (error) => {
  const data = error.response?.data;
  const message =
    (data && !(data instanceof Blob) && data.message) ||
    (error.code === 'ECONNABORTED' ? 'השרת לא הגיב בזמן. נסו שוב' : null) ||
    (!error.response ? 'אין חיבור לשרת. בדקו שהשרת פועל' : 'אירעה שגיאה. נסו שוב');
  return Object.assign(new Error(message), { status: error.response?.status, details: data?.details });
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config } = error;
    const expired = error.response?.status === 401 && config && !isPublicAuthCall(config.url) && tokenStore.getRefresh();

    if (expired && !config._retried) {
      if (await refreshSession()) {
        config._retried = true;
        return api(config);
      }
      // The session cannot be renewed -> back to the login screen
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(toError(error));
  }
);

/** The API wraps every answer as { success, data, meta } */
export const unwrap = (request) => request.then((res) => res.data.data);
export const unwrapWithMeta = (request) => request.then((res) => ({ data: res.data.data, meta: res.data.meta }));

/** Removes empty values so they are not sent as query parameters. */
export const cleanParams = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined));

export default api;
