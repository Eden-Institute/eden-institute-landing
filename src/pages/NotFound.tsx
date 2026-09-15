import { useEffect } from "react";
import Navbar from "@/components/landing/Navbar";

const NotFound = () => {
  // Unknown paths are served the SPA shell with HTTP 200 (vercel.json catch-all),
  // and index.html says index, follow. Mark this page noindex so crawlers treat
  // it as a 404, and restore the shell's value on unmount so the next route
  // stays indexable.
  useEffect(() => {
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previous = existing?.getAttribute("content") ?? null;
    const tag = existing ?? document.createElement("meta");
    if (!existing) {
      tag.setAttribute("name", "robots");
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", "noindex");
    return () => {
      if (existing && previous !== null) existing.setAttribute("content", previous);
      else tag.remove();
    };
  }, []);

  return (
    <>
      <Navbar />
      <div className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-muted">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
          <a href="/" className="text-primary underline hover:text-primary/90">
            Return to Home
          </a>
        </div>
      </div>
    </>
  );
};

export default NotFound;
