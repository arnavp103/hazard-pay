/**
 * THROWAWAY PROTOTYPE (#82): write the atlas as an 8-bit INDEXED PNG.
 *
 * pngjs only writes truecolour, which throws away the main practical prize of
 * quantizing to a fixed palette. A 33-entry sheet needs one byte per pixel and
 * a 34-entry PLTE, not four bytes per pixel — and on this atlas that is the
 * difference between ~170 KiB and ~30 KiB. Since the atlas is committed to the
 * branch and the bake-off is explicitly weighing asset cost, the number is
 * worth the sixty lines.
 *
 * Deliberately minimal and deterministic: no interlacing, filter 0 on every
 * scanline, fixed zlib level. Two bakes of the same rig produce identical
 * bytes. Browsers (and pngjs, for the round-trip check) expand indexed PNGs to
 * RGBA on decode, so nothing downstream needs to know.
 */

import { deflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

export interface IndexedImage {
  width: number;
  height: number;
  /** One byte per pixel; 0 must be the fully transparent entry. */
  indices: Uint8Array;
  /** RGB triples, entry 0 first. */
  palette: [number, number, number][];
}

/**
 * Convert straight-alpha RGBA to indices against `hexes`. Index 0 is reserved
 * for transparency, so palette entry i lands on index i + 1. Throws on an
 * off-palette colour rather than picking a nearest neighbour: by this point in
 * the pipeline everything has already been quantized, and a surprise colour
 * means a bug upstream, not a rounding decision to make here.
 */
export function toIndexed(
  rgba: Uint8Array,
  width: number,
  height: number,
  hexes: readonly string[],
): IndexedImage {
  const lookup = new Map<number, number>();
  const palette: [number, number, number][] = [[0, 0, 0]];
  hexes.forEach((hex, i) => {
    const value = Number.parseInt(hex.slice(1), 16);
    lookup.set(value, i + 1);
    palette.push([(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]);
  });

  const indices = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    if ((rgba[i * 4 + 3] ?? 0) === 0) { continue; }
    const key = ((rgba[i * 4] ?? 0) << 16) | ((rgba[i * 4 + 1] ?? 0) << 8) | (rgba[i * 4 + 2] ?? 0);
    const index = lookup.get(key);
    if (index === undefined) {
      throw new Error(`off-palette colour #${key.toString(16).padStart(6, "0")} reached the atlas writer`);
    }
    indices[i] = index;
  }
  return { width, height, indices, palette };
}

export function writeIndexedPng(image: IndexedImage): Buffer {
  const { width, height, indices, palette } = image;

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(3, 9); // colour type: indexed
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const plte = Buffer.alloc(palette.length * 3);
  palette.forEach(([r, g, b], i) => {
    plte.writeUInt8(r, i * 3);
    plte.writeUInt8(g, i * 3 + 1);
    plte.writeUInt8(b, i * 3 + 2);
  });

  // Only entry 0 is transparent; tRNS may stop there and every later entry is
  // implicitly opaque.
  const trns = Buffer.from([0x00]);

  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw.writeUInt8(0, y * (width + 1)); // filter: None
    Buffer.from(indices.buffer, indices.byteOffset + y * width, width)
      .copy(raw, y * (width + 1) + 1);
  }

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("PLTE", plte),
    chunk("tRNS", trns),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
