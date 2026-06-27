import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Button,
} from "eden-institute";

export function TermDefinition() {
  return (
    <div style={{ padding: "48px 24px", display: "flex", justifyContent: "center" }}>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <span
            className="font-serif"
            style={{
              borderBottom: "1px dotted hsl(var(--eden-forest))",
              color: "hsl(var(--eden-bark))",
              cursor: "help",
            }}
          >
            Demulcent
          </span>
        </TooltipTrigger>
        <TooltipContent
          style={{
            background: "hsl(var(--eden-forest))",
            color: "hsl(var(--eden-cream))",
            maxWidth: 220,
          }}
          className="font-body"
        >
          A herb that soothes and coats irritated tissue, such as marshmallow root.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function ActionHint() {
  return (
    <div style={{ padding: "48px 24px", display: "flex", justifyContent: "center" }}>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <Button variant="eden-outline" size="sm">
            Save to Materia Medica
          </Button>
        </TooltipTrigger>
        <TooltipContent
          style={{
            background: "hsl(var(--eden-bark))",
            color: "hsl(var(--eden-cream))",
          }}
          className="font-body"
        >
          Adds Nettle to your personal monograph shelf.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
