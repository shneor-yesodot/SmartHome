import { useEffect } from "react";
import { setTokens } from "@/api/client";
import { safeReturnTo } from "@/lib/authReturnTo";
import PageLoader from "@/components/common/PageLoader";

// Landing page after Google sign-in. The server puts the token pair in the URL
// fragment so it never reaches server logs or the Referer header.
export default function OAuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const access = params.get("access_token");
    const refresh = params.get("refresh_token");
    if (!access || !refresh) {
      window.location.replace("/login");
      return;
    }
    setTokens(access, refresh);
    window.location.replace(safeReturnTo());
  }, []);

  return <PageLoader />;
}
