import { Avatar, AvatarFallback } from "eden-institute";

export function Practitioner() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Avatar>
        <AvatarFallback
          style={{
            background: "hsl(var(--eden-forest))",
            color: "hsl(var(--eden-cream))",
          }}
          className="font-serif"
        >
          CJ
        </AvatarFallback>
      </Avatar>
      <div className="font-body">
        <div className="font-serif" style={{ color: "hsl(var(--eden-bark))" }}>
          Camila Johnson
        </div>
        <div
          className="font-accent tracking-[0.25em] uppercase"
          style={{ fontSize: 10, color: "hsl(var(--eden-forest))" }}
        >
          Practitioner tier
        </div>
      </div>
    </div>
  );
}

export function StudyCircle() {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {[
        { initials: "EB", bg: "hsl(var(--eden-forest))", fg: "hsl(var(--eden-cream))" },
        { initials: "NT", bg: "hsl(var(--eden-gold))", fg: "hsl(var(--eden-bark))" },
        { initials: "TS", bg: "hsl(var(--eden-bark))", fg: "hsl(var(--eden-cream))" },
        { initials: "CH", bg: "hsl(var(--eden-parchment))", fg: "hsl(var(--eden-bark))" },
      ].map((a, i) => (
        <Avatar
          key={a.initials}
          style={{
            marginLeft: i === 0 ? 0 : -10,
            border: "2px solid hsl(var(--eden-cream))",
          }}
        >
          <AvatarFallback
            className="font-serif"
            style={{ background: a.bg, color: a.fg, fontSize: 13 }}
          >
            {a.initials}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
}
