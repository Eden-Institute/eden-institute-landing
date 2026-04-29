import { useEffect } from "react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Link } from "react-router-dom";

const HEADER_IMG = "https://images.unsplash.com/photo-1726996155615-e986ed87c9d4?auto=format&fit=crop&w=1920&q=80";

const Terms = () => {
  useEffect(() => {
    document.title = "Terms and Conditions — The Eden Institute";
    document.querySelector('meta[name="description"]')?.setAttribute("content", "Terms and conditions for The Eden Institute's Biblical clinical herbalism education platform and services.");
  }, []);


  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background text-foreground">
        {/* Header with botanical image */}
        <header className="relative overflow-hidden py-16 md:py-20 text-center">
          <img src={HEADER_IMG} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(var(--eden-forest) / 0.88), hsl(var(--eden-forest) / 0.92))" }} />
          <div className="relative z-10">
            <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2" style={{ color: "hsl(var(--eden-parchment))" }}>Terms and Conditions</h1>
            <p className="font-body text-sm" style={{ color: "hsl(var(--eden-parchment) / 0.8)" }}>The Eden Institute — edeninstitute.health</p>
            <p className="font-body text-xs mt-2" style={{ color: "hsl(var(--eden-parchment) / 0.6)" }}>Effective Date: June 9, 2026 · Last Updated: March 11, 2026</p>
          </div>
        </header>

        <article className="max-w-3xl mx-auto px-6 py-12 font-body text-foreground/90 leading-relaxed space-y-8">
          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">1. Agreement to Terms</h2>
            <p>By accessing or using the website and services of The Eden Institute (operated by Rooted in Faith Ventures, located in Clarksville, Tennessee, United States), you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must discontinue use of the website and services immediately.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">2. Definitions</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>"The Eden Institute," "we," "us," or "our" refers to The Eden Institute, a Biblical clinical herbalism education platform operated by Rooted in Faith Ventures.</li>
              <li>"User," "you," or "your" refers to any individual accessing the website or enrolling in courses.</li>
              <li>"Services" refers to all digital educational content, courses, programs, community features, and resources available through the website.</li>
              <li>"Content" refers to all text, graphics, images, audio, video, software, data compilations, and any other material published on the website.</li>
              <li>"Website" refers to edeninstitute.health and any associated subdomains, including the course delivery platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">3. Eligibility</h2>
            <p>You must be at least 18 years of age to create an account and purchase courses. Individuals under 18 may access course content only under the supervision of a parent or legal guardian. Payment information must be provided by an adult.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">4. Account Registration</h2>
            <p>To enroll in a course, you must create an account with accurate and complete information. You are responsible for maintaining the confidentiality of your login credentials. You agree to notify us immediately if you believe your account has been accessed without authorization.</p>
            <p className="mt-2">We reserve the right to suspend or terminate accounts that violate these Terms.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">5. Course Enrollment and Access</h2>
            <p>Upon successful payment, you will receive immediate access to the course(s) purchased. Course access is granted to the individual enrollee only and may not be shared, transferred, or resold.</p>
            <p className="mt-2">We reserve the right to modify course content, structure, or delivery methods at any time to improve the educational experience.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">6. Pricing and Payment</h2>
            <p>All prices are listed in U.S. Dollars (USD). Payment is processed securely through Stripe. We accept major credit and debit cards.</p>
            <p className="mt-2">Payment plans, when available, require timely installment payments. Failure to complete installment payments may result in suspension of course access until the balance is resolved.</p>
            <p className="mt-2">Promotional pricing and coupon codes are subject to availability, usage limits, and expiration dates as specified at the time of offer.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">7. Refund Policy</h2>
            <p>Due to the digital nature of our products, all sales are final once course access has been granted. If you experience a technical issue that prevents you from accessing your purchased course, please contact us within 14 days of purchase and we will work to resolve the issue.</p>
            <p className="mt-2">Refund requests for extenuating circumstances will be reviewed on a case-by-case basis at our sole discretion. To request a refund, contact us at the email address provided below.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">8. Intellectual Property</h2>
            <p>All content on this website — including but not limited to course materials, videos, audio recordings, written text, images, graphics, logos, slide decks, companion PDFs, worksheets, quizzes, and curriculum design — is the exclusive intellectual property of The Eden Institute and Camila Johnson, protected under U.S. Copyright Law (Title 17, U.S. Code).</p>
            <p className="mt-2">You may not reproduce, copy, distribute, publish, display, modify, create derivative works from, or commercially exploit any content from this website or its courses without express written permission from The Eden Institute.</p>
            <p className="mt-2">Unauthorized reproduction or distribution of course materials may result in immediate account termination and legal action.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">9. Permitted Use</h2>
            <p>You may download and print companion PDFs and worksheets for your personal educational use only. You may not share downloaded materials with individuals who are not enrolled in the course.</p>
            <p className="mt-2">Course video content may not be screen-recorded, downloaded, or redistributed in any form.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">10. User Conduct</h2>
            <p>When using community features, discussion boards, or any communication tools provided through The Eden Institute, you agree to conduct yourself respectfully. You may not post content that is abusive, threatening, harassing, defamatory, obscene, or otherwise objectionable. You may not impersonate another person or misrepresent your identity. You may not use the platform for spam, unauthorized advertising, or solicitation. You may not share content that violates any applicable law.</p>
            <p className="mt-2">We reserve the right to remove content and suspend or terminate accounts that violate these standards.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">11. Health and Medical Disclaimer</h2>
            <p className="font-semibold text-accent">IMPORTANT: The Eden Institute provides educational content about herbalism, nutrition, and wellness from a Biblical worldview. This content is for educational and informational purposes only and is not intended to diagnose, treat, cure, or prevent any disease or medical condition.</p>
            <p className="mt-2">Nothing on this website or in our courses should be construed as medical advice. Always consult a qualified healthcare provider before making changes to your health regimen, especially if you are pregnant, nursing, taking medications, or managing a diagnosed medical condition.</p>
            <p className="mt-2">The Eden Institute, its founder, instructors, and affiliates assume no liability for any adverse effects resulting from the use or application of information presented in our courses.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">12. Third-Party Links</h2>
            <p>Our website may contain links to third-party websites or services. We are not responsible for the content, privacy practices, or availability of these external sites. Inclusion of a link does not imply endorsement.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">13. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, The Eden Institute shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the website or courses. This includes, without limitation, loss of data, loss of profits, or business interruption.</p>
            <p className="mt-2">Our total liability to you for any claim arising from these Terms or your use of our Services shall not exceed the amount you paid for the specific course giving rise to the claim.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">14. Indemnification</h2>
            <p>You agree to indemnify and hold harmless The Eden Institute, its owner, affiliates, and agents from any claims, damages, losses, or expenses (including reasonable legal fees) arising from your violation of these Terms, your use of the Services, or your violation of any rights of a third party.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">15. Modifications to Terms</h2>
            <p>We reserve the right to update these Terms and Conditions at any time. Changes will be posted on this page with an updated effective date. Your continued use of the website after changes are posted constitutes acceptance of the revised Terms.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">16. Termination</h2>
            <p>We may terminate or suspend your account and access to Services at our sole discretion, without prior notice, for conduct that we determine violates these Terms or is harmful to other users, us, or third parties, or for any other reason.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">17. Privacy</h2>
            <p>Your use of the website is also governed by our <Link to="/privacy" className="text-accent underline hover:text-accent/80">Privacy Policy</Link>. By using our Services, you consent to the collection and use of information as described therein.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">18. Governing Law</h2>
            <p>These Terms and Conditions shall be governed by and construed in accordance with the laws of the State of Tennessee, United States, without regard to conflict of law principles. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts located in Montgomery County, Tennessee.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">19. Severability</h2>
            <p>If any provision of these Terms is found to be unlawful, void, or unenforceable, that provision shall be deemed severed and shall not affect the validity and enforceability of the remaining provisions.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">20. No Waiver</h2>
            <p>Our failure to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">21. Entire Agreement</h2>
            <p>These Terms and Conditions, together with our <Link to="/privacy" className="text-accent underline hover:text-accent/80">Privacy Policy</Link> and <Link to="/cookies" className="text-accent underline hover:text-accent/80">Cookie Policy</Link>, constitute the entire agreement between you and The Eden Institute regarding your use of the website and Services.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-primary mb-3">22. Contact</h2>
            <p>If you have questions about these Terms, please contact us at:</p>
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
    </>
  );
};

export default Terms;
