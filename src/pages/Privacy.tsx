import Footer from "@/components/landing/Footer";
import { Link } from "react-router-dom";

const Privacy = () => {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="bg-primary text-primary-foreground py-10 text-center">
        <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="font-body text-sm opacity-80">The Eden Institute — edeninstitute.health</p>
        <p className="font-body text-xs mt-2 opacity-60">Effective Date: June 9, 2026 · Last Updated: March 11, 2026</p>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12 font-body text-foreground/90 leading-relaxed space-y-8">
        <section>
          <h2 className="font-serif text-xl font-semibold text-primary mb-3">1. Introduction</h2>
          <p>The Eden Institute ("we," "us," or "our") respects your privacy and is committed to protecting the personal information you share with us. This Privacy Policy explains what information we collect, how we use it, and your rights regarding your data.</p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-primary mb-3">2. Information We Collect</h2>
          <h3 className="font-serif text-lg font-medium text-foreground/80 mb-2">Information you provide directly:</h3>
          <ul className="list-disc pl-6 space-y-1 mb-4">
            <li>Name and email address (when creating an account or taking the Constitutional Quiz).</li>
            <li>Password (encrypted and stored securely).</li>
            <li>Payment information (processed securely by Stripe — we do not store credit card numbers).</li>
            <li>Quiz responses and constitutional type results.</li>
            <li>Community posts and discussion contributions.</li>
          </ul>
          <h3 className="font-serif text-lg font-medium text-foreground/80 mb-2">Information collected automatically:</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>IP address and approximate location.</li>
            <li>Browser type, device type, and operating system.</li>
            <li>Pages visited, time spent on pages, and navigation patterns.</li>
            <li>Cookies and similar tracking technologies (see our <Link to="/cookies" className="text-accent underline hover:text-accent/80">Cookie Policy</Link>).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-primary mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Provide and deliver courses and educational content.</li>
            <li>Process payments and manage your account.</li>
            <li>Send transactional emails (enrollment confirmation, course completion, invoices).</li>
            <li>Send nurture and marketing emails (only with your consent, and you may unsubscribe at any time).</li>
            <li>Personalize your experience (such as constitutional type-based content).</li>
            <li>Improve our website, courses, and services.</li>
            <li>Respond to your questions or support requests.</li>
            <li>Protect against fraud and unauthorized access.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-primary mb-3">4. Email Communications</h2>
          <p>When you take the Constitutional Quiz, you consent to receiving a nurture email sequence related to your quiz results and our educational offerings. You may unsubscribe from marketing emails at any time by clicking the "Unsubscribe" link in any email. Transactional emails (such as enrollment confirmations and invoices) are not subject to unsubscribe as they are necessary for service delivery.</p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-primary mb-3">5. How We Share Your Information</h2>
          <p>We do not sell, rent, or trade your personal information. We may share information with trusted third-party service providers who assist in operating our business, including:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li><strong>Stripe</strong> — for payment processing.</li>
            <li><strong>LearnWorlds</strong> — for course delivery and student management.</li>
            <li><strong>Resend</strong> — for email delivery.</li>
          </ul>
          <p className="mt-2">These providers are contractually obligated to protect your information and use it only for the purposes we specify.</p>
          <p className="mt-2">We may also disclose information if required by law, court order, or governmental regulation, or to protect the rights, property, or safety of The Eden Institute, our users, or others.</p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-primary mb-3">6. Data Security</h2>
          <p>We implement reasonable administrative, technical, and physical safeguards to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.</p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-primary mb-3">7. Data Retention</h2>
          <p>We retain your personal information for as long as your account is active or as needed to provide services. If you request account deletion, we will remove your personal data within 30 days, except where retention is required by law or for legitimate business purposes (such as financial records).</p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-primary mb-3">8. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Access the personal information we hold about you.</li>
            <li>Request correction of inaccurate information.</li>
            <li>Request deletion of your account and personal data.</li>
            <li>Opt out of marketing communications at any time.</li>
            <li>Request a copy of your data in a portable format.</li>
          </ul>
          <p className="mt-2">To exercise any of these rights, contact us at the email address provided below.</p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-primary mb-3">9. Children's Privacy</h2>
          <p>Our services are not directed to children under 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected information from a child under 13, we will take steps to delete it promptly.</p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-primary mb-3">10. Third-Party Links</h2>
          <p>Our website may contain links to third-party websites. We are not responsible for the privacy practices of these external sites. We encourage you to review the privacy policies of any third-party site you visit.</p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-primary mb-3">11. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated effective date. Your continued use of the website after changes are posted constitutes acceptance of the revised policy.</p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-primary mb-3">12. Contact</h2>
          <p>If you have questions about this Privacy Policy or wish to exercise your data rights, please contact us at:</p>
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

export default Privacy;
