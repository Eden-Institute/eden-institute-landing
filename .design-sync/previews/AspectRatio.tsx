import { AspectRatio } from "eden-institute";

export function HerbPlate() {
  return (
    <div style={{ width: 320 }}>
      <AspectRatio ratio={16 / 9}>
        <div
          style={{
            height: "100%",
            width: "100%",
            borderRadius: 10,
            background: "hsl(var(--eden-forest))",
            color: "hsl(var(--eden-cream))",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="font-accent tracking-[0.25em] uppercase"
            style={{ fontSize: 10, color: "hsl(var(--eden-gold))" }}
          >
            Botanical Plate
          </div>
          <div className="font-serif" style={{ fontSize: 22, marginTop: 4 }}>
            Chamomile
          </div>
          <div className="font-body" style={{ fontSize: 12, marginTop: 2 }}>
            16 : 9
          </div>
        </div>
      </AspectRatio>
    </div>
  );
}

export function SquareThumb() {
  return (
    <div style={{ width: 200 }}>
      <AspectRatio ratio={1}>
        <div
          style={{
            height: "100%",
            width: "100%",
            borderRadius: 10,
            background: "hsl(var(--eden-parchment))",
            border: "2px solid hsl(var(--eden-gold))",
            color: "hsl(var(--eden-bark))",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div className="font-serif" style={{ fontSize: 20 }}>
            Nettle
          </div>
          <div className="font-body" style={{ fontSize: 12, marginTop: 2 }}>
            1 : 1 thumbnail
          </div>
        </div>
      </AspectRatio>
    </div>
  );
}
