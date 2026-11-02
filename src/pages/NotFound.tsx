import { useLocation } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { ASTRO_PAGES } from "@/lib/routes";
import { useDocumentMeta } from "@/lib/useDocumentMeta";

const NotFound = () => {
  const { pathname } = useLocation();
  // A hard load of an unknown path gets a real HTTP 404 from Vercel
  // (web/pages/404.astro): vercel.json rewrites only the SPA's own routes to
  // the shell. This page still shows for a client-side navigation to a path
  // the router does not know, inside a shell whose index.html says index,
  // follow. Mark it noindex; useDocumentMeta restores the shell's robots value
  // on unmount, so the next route stays indexable.
  useDocumentMeta({
    title: "Page not found | The Eden Institute",
    description: "This page could not be found. Start with the Eden's Table homeschool curriculum or the free curriculum samples.",
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
            {/* Both are Astro pages, not SPA routes, so a full page load (a), not <Link>. */}
            <Button asChild variant="eden" size="lg">
              <a href={ASTRO_PAGES.HOMESCHOOL}>Homeschool Curriculum</a>
            </Button>
            <Button asChild variant="eden-outline" size="lg">
              <a href="/freebies">Freebies</a>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default NotFound;
