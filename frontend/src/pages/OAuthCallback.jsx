import { useEffect } from 'react';
import { PageLoader } from '../components/ui/States';
import { tokenStore } from '../services/api';

/** Only same-site paths are allowed (blocks open redirects). */
const safePath = (value) =>
  value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/';

/**
 * Landing page after Google sign-in. The server puts the tokens in the URL
 * fragment (never sent to any server); we store them and reload into the app.
 */
export default function OAuthCallback() {
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const token = fragment.get('token');
    const refreshToken = fragment.get('refreshToken');
    if (!token || !refreshToken) {
      window.location.replace('/login?error=google');
      return;
    }
    tokenStore.set({ token, refreshToken });
    const returnTo = new URLSearchParams(window.location.search).get('returnTo');
    window.location.replace(safePath(returnTo));
  }, []);

  return <PageLoader label="מתחברים" />;
}
