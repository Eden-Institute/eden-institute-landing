// Metadata for Eden's Materia Medica herb plates (antique apothecary illustrations).
export type HerbSlug =
  | "calendula" | "catnip" | "chamomile" | "elderberry" | "fennel" | "ginger"
  | "lavender" | "lemon-balm" | "linden" | "marshmallow-root" | "mullein"
  | "nettle" | "peppermint" | "plantain" | "slippery-elm" | "tulsi";

export interface HerbMeta {
  name: string;
  latin: string;
}

export const HERBS: Record<HerbSlug, HerbMeta> = {
  "calendula": { name: "Calendula", latin: "Calendula officinalis" },
  "catnip": { name: "Catnip", latin: "Nepeta cataria" },
  "chamomile": { name: "Chamomile", latin: "Matricaria chamomilla" },
  "elderberry": { name: "Elderberry", latin: "Sambucus nigra" },
  "fennel": { name: "Fennel", latin: "Foeniculum vulgare" },
  "ginger": { name: "Ginger", latin: "Zingiber officinale" },
  "lavender": { name: "Lavender", latin: "Lavandula angustifolia" },
  "lemon-balm": { name: "Lemon Balm", latin: "Melissa officinalis" },
  "linden": { name: "Linden", latin: "Tilia × europaea" },
  "marshmallow-root": { name: "Marshmallow Root", latin: "Althaea officinalis" },
  "mullein": { name: "Mullein", latin: "Verbascum thapsus" },
  "nettle": { name: "Nettle", latin: "Urtica dioica" },
  "peppermint": { name: "Peppermint", latin: "Mentha × piperita" },
  "plantain": { name: "Plantain", latin: "Plantago major" },
  "slippery-elm": { name: "Slippery Elm", latin: "Ulmus rubra" },
  "tulsi": { name: "Tulsi", latin: "Ocimum sanctum" },
};

export const HERB_SLUGS = Object.keys(HERBS) as HerbSlug[];
