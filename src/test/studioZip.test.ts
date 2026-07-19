// The zip writer is hand-rolled, and a malformed archive fails in the worst
// possible way: it looks fine until the founder double-clicks it. So these
// tests parse the produced bytes back out rather than trusting the writer.

import { describe, it, expect } from "vitest";
import { safeZipName, zipStore } from "@/studio/studio-zip";

const FIXED = new Date(2026, 6, 18, 12, 30, 0); // deterministic DOS timestamp

// zipStore returns raw bytes, so no Blob round-trip is needed.

/** Minimal reader: walks the central directory the way a real unzip would. */
function readZip(buf: Uint8Array) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // End-of-central-directory is the last 22 bytes when there is no comment.
  const eocd = buf.length - 22;
  if (dv.getUint32(eocd, true) !== 0x06054b50) throw new Error("no EOCD signature");
  const count = dv.getUint16(eocd + 10, true);
  const cdSize = dv.getUint32(eocd + 12, true);
  const cdOffset = dv.getUint32(eocd + 16, true);

  const dec = new TextDecoder();
  const entries: Array<{ name: string; size: number; crc: number; data: Uint8Array }> = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("bad central signature");
    const crc = dv.getUint32(p + 16, true);
    const size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const localOff = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));

    if (dv.getUint32(localOff, true) !== 0x04034b50) throw new Error("bad local signature");
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    // Copy rather than subarray: a view carries its parent buffer, and deep
    // equality against a standalone array then fails with identical bytes.
    entries.push({
      name, size, crc,
      data: new Uint8Array(buf.subarray(dataStart, dataStart + size)),
    });
    p += 46 + nameLen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  return { count, cdSize, cdOffset, entries };
}

describe("zipStore", () => {
  it("round-trips file names and contents", () => {
    const a = new TextEncoder().encode("hello eden");
    const b = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x10]);
    const zip = (zipStore([
      { name: "eden-1x1.png", data: a },
      { name: "eden-9x16.png", data: b },
    ], FIXED));

    const parsed = readZip(zip);
    expect(parsed.count).toBe(2);
    expect(parsed.entries.map((e) => e.name)).toEqual(["eden-1x1.png", "eden-9x16.png"]);
    // Compare bytes, not objects: under jsdom, TextEncoder returns a
    // Uint8Array from a different realm, so deep equality fails on identical
    // contents.
    expect(Array.from(parsed.entries[0].data)).toEqual(Array.from(a));
    expect(Array.from(parsed.entries[1].data)).toEqual(Array.from(b));
    expect(parsed.entries[0].size).toBe(a.length);
  });

  it("computes CRC32 correctly against the standard test vector", () => {
    // crc32("123456789") === 0xCBF43926, the canonical check value.
    const zip = (zipStore(
      [{ name: "check.txt", data: new TextEncoder().encode("123456789") }], FIXED,
    ));
    expect(readZip(zip).entries[0].crc).toBe(0xcbf43926);
  });

  it("points the central directory at the real offset", () => {
    const zip = (zipStore([
      { name: "a.bin", data: new Uint8Array(11) },
      { name: "b.bin", data: new Uint8Array(23) },
    ], FIXED));
    const parsed = readZip(zip);
    // Central directory starts where the local entries end.
    const expected = (30 + 5 + 11) + (30 + 5 + 23);
    expect(parsed.cdOffset).toBe(expected);
    expect(parsed.cdOffset + parsed.cdSize + 22).toBe(zip.length);
  });

  it("handles an empty archive without corrupting the trailer", () => {
    const zip = (zipStore([], FIXED));
    const parsed = readZip(zip);
    expect(parsed.count).toBe(0);
    expect(zip.length).toBe(22);
  });

  it("preserves binary bytes that would break a text encoding", () => {
    const raw = new Uint8Array([0, 1, 254, 255, 128, 127, 0]);
    const zip = (zipStore([{ name: "raw.bin", data: raw }], FIXED));
    expect(Array.from(readZip(zip).entries[0].data)).toEqual(Array.from(raw));
  });
});

describe("safeZipName", () => {
  it("strips characters that break filesystems", () => {
    expect(safeZipName("Eden's Table: 4:5 / preorder?")).toBe("Eden-s-Table-4-5-preorder");
  });
  it("never returns an empty name", () => {
    expect(safeZipName("///")).toBe("file");
  });
});
