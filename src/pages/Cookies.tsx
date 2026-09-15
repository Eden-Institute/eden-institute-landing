import { useDocumentMeta } from "@/lib/useDocumentMeta";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const HEADER_IMG = "https://images.unsplash.com/photo-1580116270858-8a0d62b15426?auto=format&fit=crop&w=1920&q=80";

const Cookies = () => {
  useDocumentMeta({
    title: "Cookie Policy — The Eden Institute",
    description:
      "Cookie policy for The Eden Institute. Understand what cookies we use and how they enhance your experience.",
    canonical: "https://edeninstitute.health/cookies",
  });


  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background text-foreground">
        {/* Header with botanical image */}
        <header className="relative overflow-hidden py-16 md:py-20 text-center">
          <img src={HEADER_IMG} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(var(--eden-forest) / 0.88), hsl(var(--eden-forest) / 0.92))" }} />
          <div className="relative z-10">
            <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2" style={{ color: "hsl(var(--eden-parchment))" }}>Cookie Policy</h1>
            <p className="font-body text-sm" style={{ color: "hsl(var(--eden-parchment) / 0.8)" }}>The Eden Institute — edeninstitute.health</p>
            <p className="font-body text-xs mt-2" style={{ color: "hsl(var(--eden-parchment) / 0.6)" }}>Effective Date: June 9, 2026 · Last Updated: September 13, 2026</p>
          </div>
        </header>

        <article className="max-w-3xl mx-auto px-6 py-12 font-body text-foreground/90 leading-relaxed space-y-8">
          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">1. What Are Cookies</h2>
            <p>Cookies are small text files stored on your device when you visit a website. They help the website remember your preferences, understand how you interact with the site, and improve your experience.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">2. How We Use Cookies</h2>

            <h3 className="font-serif text-lg font-medium text-foreground/80 mb-2">Essential Cookies:</h3>
            <p className="mb-4">These are necessary for the website to function properly. They enable core features such as account login, course access, shopping cart functionality, and security. You cannot opt out of essential cookies as the site will not function without them.</p>

            <h3 className="font-serif text-lg font-medium text-foreground/80 mb-2">Analytics Cookies:</h3>
            <p className="mb-4">These help us understand how visitors use our website, such as which pages are visited, how long people stay on a page, and how they move around the site. We use Google Analytics for this. Google Analytics runs by default when you visit. If you click Decline on the cookie banner, we turn Google Analytics off for that browser.</p>

            <h3 className="font-serif text-lg font-medium text-foreground/80 mb-2">Marketing Cookies:</h3>
            <p className="mb-4">These help us measure our advertising. We use the Pinterest tag to measure visits, sign-ups and purchases on our website, including those that come from our Pinterest ads. The Pinterest tag runs by default when you visit. If you click Decline on the cookie banner, we tell Pinterest to stop, so the tag stops sending events from that browser and deletes the cookies it set on our website.</p>
            <p className="mb-4">The Meta (Facebook) pixel works differently. It only loads after you click Accept.</p>
            <p>When you give us your email address to get a freebie or join a waitlist, or when you buy printed books on our website, and only if you have clicked Accept, we also send Pinterest a hashed version of that email address. Hashing turns the address into a scrambled code in your browser before it is sent. Pinterest uses it to match the sign-up or purchase to a Pinterest account. If you have not clicked Accept, the email hash is not sent.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">3. Your Cookie Choices</h2>
            <p>When you first visit our website, you will see a cookie banner with two buttons:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Decline</strong> turns Google Analytics and the Pinterest tag off for that browser. The Meta pixel stays off.</li>
              <li><strong>Accept</strong> keeps Google Analytics and the Pinterest tag on, loads the Meta pixel, and allows the email hash described above to be sent to Pinterest.</li>
            </ul>
            <p className="mt-2">Until you choose, Google Analytics and the Pinterest tag run as normal. Your choice is saved in your browser, so it only applies to that browser on that device. To change it later, clear the cookies and site data for our website in your browser settings, and the banner will ask again.</p>
            <p className="mt-2">Additionally, you can control cookies through your browser settings. Most browsers allow you to block or delete cookies. However, blocking essential cookies may impair your ability to use certain features of the website.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">4. Third-Party Cookies</h2>
            <p>Some cookies on our site are set by third-party services we use, including:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>LearnWorlds</strong> (course platform).</li>
              <li><strong>Stripe</strong> (payment processing).</li>
              <li><strong>Google Analytics</strong> (website analytics). Runs by default; clicking Decline turns it off.</li>
              <li><strong>Pinterest</strong> (advertising measurement). Runs by default; clicking Decline turns it off.</li>
              <li><strong>Meta (Facebook)</strong> (advertising measurement). Only loads after you click Accept.</li>
            </ul>
            <p className="mt-2">These third parties have their own cookie and privacy policies, which we encourage you to review.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">5. Changes to This Policy</h2>
            <p>We may update this Cookie Policy from time to time. Changes will be posted on this page with an updated effective date.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">6. Contact</h2>
            <p>If you have questions about our use of cookies, please contact us at:</p>
            <address className="mt-3 not-italic text-foreground/70">
              <p className="font-semibold">The Eden Institute</p>
              <p>Operated by Rooted in Faith Ventures</p>
              <p>303 Holly Cir, Unit 3262</p>
              <p>Clarksville, TN 37043, United States</p>
              <p>Website: edeninstitute.health</p>
              <p>Email: <a href="mailto:hello@edeninstitute.health" className="underline" style={{ color: "hsl(var(--eden-gold-ink))" }}>hello@edeninstitute.health</a></p>
            </address>
          </section>
        </article>

        <Footer />
      </main>
    </>
  );
};

export default Cookies;
