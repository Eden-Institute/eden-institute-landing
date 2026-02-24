const Footer = () => {
  return (
    <footer className="section-padding bg-eden-bark text-eden-parchment/60">
      <div className="eden-container text-center">
        <p className="font-serif text-xl font-semibold text-eden-parchment mb-2">
          The Eden Institute
        </p>
        <p className="font-body text-sm mb-4">
          edeninstitute.health
        </p>
        <div className="eden-divider" />
        <p className="font-accent text-sm tracking-[0.3em] uppercase text-eden-gold">
          "Back to Eden. Back to Truth."
        </p>
        <p className="mt-8 font-body text-xs text-eden-parchment/30">
          © {new Date().getFullYear()} The Eden Institute. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
