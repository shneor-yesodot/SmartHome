import { useEffect } from 'react';
import { PageLoader } from '../components/ui/States';
import { tokenStore } from '../services/api';

/** Only same-site paths are allowed (blocks open redirects). */
const safePath = (value) =>
  value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/';

/**
 * Landing page after Google sign-in. The server already set the session cookie;
 * reloading into the app makes it fetch an access token with that cookie.
 */
export default function OAuthCallback() {
  useEffect(() => {
    tokenStore.set({ token: null });
    const returnTo = new URLSearchParams(window.location.search).get('returnTo');
    window.location.replace(safePath(returnTo));
  }, []);

  return <PageLoader label="מתחברים" />;
}
