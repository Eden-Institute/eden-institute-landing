// The one "not open yet" state every /wired page shows while the quiz is dark (WIRED_ENABLED off): the exact
// sentence /wired has always used (no new wording), set large and centred so it reads as a deliberate message,
// not a page that failed to load (Camila 2026-11-20: "make those pages say not open yet").
export const NOT_OPEN = "This page isn't open yet.";

export default function WiredNotOpen() {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center" style={{ color: "hsl(var(--eden-bark))" }} role="status">
      <p className="font-display text-2xl sm:text-3xl" style={{ color: "hsl(var(--eden-forest))" }}>{NOT_OPEN}</p>
    </div>
  );
}
