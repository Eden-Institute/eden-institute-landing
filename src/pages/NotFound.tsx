import { Link, useLocation } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { useDocumentMeta } from "@/lib/useDocumentMeta";

const NotFound = () => {
  const { pathname } = useLocation();
  // Unknown paths are served the SPA shell with HTTP 200 (vercel.json catch-all),
  // and index.html says index, follow. Mark this page noindex so crawlers treat
  // it as a 404; useDocumentMeta restores the shell's robots value on unmount,
  // so the next route stays indexable.
  useDocumentMeta({
    title: "Page not found | The Eden Institute",
    description: "This page could not be found. Take the free Pattern of Eden quiz or browse the herbs in the Eden Apothecary.",
    canonical: `https://edeninstitute.health${pathname}`,
    robots: "noindex, follow",
  });

  return (
    <>
      <Navbar />
      <main
        className="flex min-h-[calc(100vh-72px)] items-center justify-center px-6 py-20"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-xl text-center">
          <p
            className="font-accent text-sm tracking-[0.3em] uppercase mb-4"
            style={{ color: "hsl(var(--eden-gold-ink))" }}
          >
            404
          </p>
          <h1
            className="font-serif text-3xl md:text-4xl font-bold mb-4"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            We couldn't find that page.
          </h1>
          <p className="font-body text-base md:text-lg leading-relaxed mb-8" style={{ color: "hsl(var(--eden-bark))" }}>
            The link may be old or mistyped. Here are two good places to start.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild variant="eden" size="lg">
              <Link to={ROUTES.ASSESSMENT}>Take the free quiz</Link>
            </Button>
            <Button asChild variant="eden-outline" size="lg">
              <Link to={ROUTES.APOTHECARY}>Browse the herbs</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default NotFound;
