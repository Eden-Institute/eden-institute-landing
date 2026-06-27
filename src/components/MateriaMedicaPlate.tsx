import * as React from "react";
import { cn } from "@/lib/utils";
import { HERBS, type HerbSlug } from "@/components/materiaMedicaHerbs";
// Imported via the @/ alias so design-sync can swap this for embedded base64
// data URLs in the Claude Design bundle (the live site uses public/ URLs).
import { PLATE_SRC } from "@/components/materiaMedicaPlateSources";

export interface MateriaMedicaPlateProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  /** Which herb plate to show. */
  herb: HerbSlug;
  /** Show a serif name + Latin caption beneath the plate. Default false — the plate already carries its title. */
  caption?: boolean;
  /** Max rendered width in pixels. Default 320. */
  width?: number;
}

/**
 * MateriaMedicaPlate — an antique apothecary illustration of a single herb,
 * in Eden's "ancient knowledge unearthed" Materia Medica style (aged parchment,
 * botanical figures, Latin binomial). Drop one in for herb monographs, hero
 * sections, or decorative apothecary moments.
 *
 * @category Materia Medica
 */
export function MateriaMedicaPlate({
  herb,
  caption = false,
  width = 320,
  className,
  ...props
}: MateriaMedicaPlateProps) {
  const meta = HERBS[herb];
  const src = PLATE_SRC[herb];
  return (
    <figure
      className={cn("inline-flex flex-col items-center m-0", className)}
      style={{ maxWidth: width }}
      {...props}
    >
      <img
        src={src}
        alt={meta ? `${meta.name} (${meta.latin}) — Eden Materia Medica plate` : herb}
        loading="lazy"
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: "var(--radius)",
          border: "1px solid hsl(var(--eden-gold) / 0.5)",
          boxShadow: "0 1px 4px hsl(var(--eden-bark) / 0.18)",
        }}
      />
      {caption && meta && (
        <figcaption className="mt-3 text-center">
          <span className="font-serif block" style={{ color: "hsl(var(--eden-bark))", fontSize: 18 }}>
            {meta.name}
          </span>
          <span className="font-body italic" style={{ color: "hsl(var(--eden-bark-light))", fontSize: 13 }}>
            {meta.latin}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

export default MateriaMedicaPlate;
