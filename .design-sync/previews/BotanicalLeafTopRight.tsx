import { BotanicalLeafTopRight } from "eden-institute";

export function OnParchment() {
  return (
    <div
      style={{
        background: "hsl(var(--eden-parchment))",
        padding: 32,
        display: "flex",
        justifyContent: "center",
        color: "hsl(var(--eden-forest))",
      }}
    >
      <BotanicalLeafTopRight className="w-40 h-40" />
    </div>
  );
}
