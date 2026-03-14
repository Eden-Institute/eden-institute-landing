import { useEffect } from "react";
import Footer from "@/components/landing/Footer";

const HEADER_IMG = "https://images.unsplash.com/photo-1580116270858-8a0d62b15426?auto=format&fit=crop&w=1920&q=80";

const Cookies = () => {
  useEffect(() => {
    document.title = "Cookie Policy — The Eden Institute";
    document.querySelector('meta[name="description"]')?.setAttribute("content", "Cookie policy for The Eden Institute. Understand what cookies we use and how they enhance your experience.");
  }, []);


  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header with botanical image */}
      <header className="relative overflow-hidden py-16 md:py-20 text-center">
        <img src={HEADER_IMG} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(var(--eden-forest) / 0.88), hsl(var(--eden-forest) / 0.92))" }} />
        <div className="relative z-10">
          <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2" style={{ color: "hsl(var(--eden-parchment))" }}>Cookie Policy</h1>
          <p className="font-body text-sm" style={{ color: "hsl(var(--eden-parchment) / 0.8)" }}>The Eden Institute — edeninstitute.health</p>
          <p className="font-body text-xs mt-2" style={{ color: "hsl(var(--eden-parchment) / 0.6)" }}>Effective Date: June 9, 2026 · Last Updated: March 11, 2026</p>
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
          <p className="mb-4">These help us understand how visitors interact with our website by collecting information about pages visited, time spent on pages, and navigation patterns. This data is aggregated and anonymized. We may use tools such as Google Analytics for this purpose.</p>

          <h3 className="font-serif text-lg font-medium text-foreground/80 mb-2">Marketing Cookies:</h3>
          <p>These may be used to deliver relevant advertisements and track the effectiveness of marketing campaigns. We will only set marketing cookies with your explicit consent.</p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-primary mb-3">3. Your Cookie Choices</h2>
          <p>When you first visit our website, you will be presented with a cookie consent banner that allows you to accept or reject non-essential cookies. You can also manage your cookie preferences at any time through the Cookie Preferences option available on our website.</p>
          <p className="mt-2">Additionally, you can control cookies through your browser settings. Most browsers allow you to block or delete cookies. However, blocking essential cookies may impair your ability to use certain features of the website.</p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-primary mb-3">4. Third-Party Cookies</h2>
          <p>Some cookies on our site are set by third-party services we use, including:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li><strong>LearnWorlds</strong> (course platform).</li>
            <li><strong>Stripe</strong> (payment processing).</li>
            <li><strong>Google Analytics</strong> (website analytics).</li>
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
            <p>Clarksville, Tennessee, United States</p>
            <p>Website: edeninstitute.health</p>
            <p>Email: <a href="mailto:hello@edeninstitute.health" className="text-accent underline">hello@edeninstitute.health</a></p>
          </address>
        </section>
      </article>

      <Footer />
    </main>
  );
};

export default Cookies;
