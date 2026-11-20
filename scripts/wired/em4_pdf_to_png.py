"""Turn the sample Blueprints from render_em4_pages.ts into the em-4 email images.

Finds the Math page (the page whose heading line, after the running footer, is exactly "Math"), renders it at 1.5x (about
900 px wide), and saves public/email/wired/blueprint-math-<wiring>.png. Real Blueprint pages only.
Usage: python scripts/wired/em4_pdf_to_png.py <dir with blueprint-*.pdf>
"""
import pathlib, sys
import fitz

src = pathlib.Path(sys.argv[1])
out = pathlib.Path(__file__).resolve().parents[2] / "public" / "email" / "wired"
out.mkdir(parents=True, exist_ok=True)
for pdf in sorted(src.glob("blueprint-*.pdf")):
    wiring = pdf.stem.split("-", 1)[1]
    doc = fitz.open(pdf)
    hits = [p for p in doc if [l.strip() for l in p.get_text().splitlines() if l.strip()][1:2] == ["Math"]]
    if len(hits) != 1:
        sys.exit(f"{pdf.name}: expected one Math page, found {len(hits)}")
    pix = hits[0].get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
    dest = out / f"blueprint-math-{wiring}.png"
    pix.save(dest)
    print(dest.name, hits[0].number + 1, pix.width, pix.height, dest.stat().st_size)
