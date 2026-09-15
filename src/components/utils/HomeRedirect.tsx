import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * The SPA's "/" route. The homepage is the static Astro page
 * (web/pages/index.astro), served for "/" by Vercel's filesystem match before
 * the /_spa rewrite, so the SPA never renders a homepage of its own.
 *
 * Every in-app home link is a plain <a href="/">. This catches anything that
 * still pushes "/" through the router (a stale <Link>, a navigate("/")) and
 * turns it into a full page load of the real homepage.
 *
 * A router key of "default" means this is the first render of a fresh page
 * load, i.e. the server itself handed the SPA shell for "/" (only the Vite dev
 * server does that). Reloading then would loop forever, so it renders a plain
 * link instead.
 */
export default function HomeRedirect() {
  const { key } = useLocation();
  const clientSideNavigation = key !== "default";

  useEffect(() => {
    if (clientSideNavigation) window.location.replace("/");
  }, [clientSideNavigation]);

  if (clientSideNavigation) return null;
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <a href="/" className="font-body text-lg underline">
        The Eden Institute home page
      </a>
    </div>
  );
}
