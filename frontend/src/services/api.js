import axios from 'axios';

// Only a hint that a session may exist, to avoid a pointless request on the login screen.
// It is not a secret: the refresh token itself is in an httpOnly cookie that scripts cannot read.
const SESSION_HINT = 'smarthome_session';

const hint = {
  get: () => {
    try {
      return localStorage.getItem(SESSION_HINT) === '1';
    } catch {
      return false;
    }
  },
  set: (on) => {
    try {
      if (on) localStorage.setItem(SESSION_HINT, '1');
      else localStorage.removeItem(SESSION_HINT);
      // Tokens that older versions of the app kept here
      localStorage.removeItem('smarthome_token');
      localStorage.removeItem('smarthome_refresh_token');
    } catch {
      // Private browsing: the session simply lasts until the tab closes
    }
  },
};

// The access token lives only in memory, so it disappears with the page
let accessToken = null;

export const tokenStore = {
  get: () => accessToken,
  hasSession: () => Boolean(accessToken) || hint.get(),
  set: ({ token }) => {
    accessToken = token;
    hint.set(true);
  },
  clear: () => {
    accessToken = null;
    hint.set(false);
  },
};

const baseURL = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({ baseURL, timeout: 90000, withCredentials: true });

// Attach the access token to every request
api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Calls where a 401 means "wrong details", not "session expired"
const PUBLIC_AUTH_CALLS = ['/auth/login', '/auth/register', '/auth/verify-email', '/auth/reset-password', '/auth/refresh', '/auth/logout'];
const isPublicAuthCall = (url = '') => PUBLIC_AUTH_CALLS.some((path) => url.startsWith(path));

const requestRefresh = async () => {
  const { data } = await axios.post(`${baseURL}/auth/refresh`, null, { timeout: 15000, withCredentials: true });
  tokenStore.set(data.data);
};

/**
 * One refresh at a time: requests that fail together wait for the same refresh.
 * If another tab refreshed in the same moment this one is refused, and a second
 * attempt succeeds with the cookie that tab received.
 */
let refreshing = null;
const refreshSession = () => {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        await requestRefresh();
        return true;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
        try {
          await requestRefresh();
          return true;
        } catch {
          return false;
        }
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
    const expired = error.response?.status === 401 && config && !isPublicAuthCall(config.url) && tokenStore.hasSession();

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
