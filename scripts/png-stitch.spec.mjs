/**
 * The stitcher, held to what would make a full-page capture quietly wrong: a
 * filter undone badly shifts every colour after it, and a tile stacked in the
 * wrong order or at the wrong width is a page that never existed.
 */
import { deflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { decodePng, encodePng, stitchPngs } from './png-stitch.mjs';

/** A width x height RGBA image whose every byte depends on where it is. */
function image(width, height, seed = 0) {
  const raw = Buffer.alloc(width * height * 4);
  for (let i = 0; i < raw.length; i += 1) raw[i] = (i * 7 + seed * 31) & 0xff;
  return { width, height, colorType: 6, raw };
}

/** The same image re-encoded with one PNG filter on every row, as Chrome may write it. */
function withFilter(img, filter) {
  const bpp = 4;
  const stride = img.width * bpp;
  const out = Buffer.alloc((stride + 1) * img.height);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < img.height; y += 1) {
    out[y * (stride + 1)] = filter;
    for (let x = 0; x < stride; x += 1) {
      const at = y * stride + x;
      const a = x >= bpp ? img.raw[at - bpp] : 0;
      const b = y > 0 ? img.raw[at - stride] : 0;
      const c = x >= bpp && y > 0 ? img.raw[at - stride - bpp] : 0;
      const predicted = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter];
      out[y * (stride + 1) + 1 + x] = (img.raw[at] - predicted) & 0xff;
    }
  }
  // The signature and IHDR from a real encode, then this IDAT and IEND. Its CRC
  // is left zero: decodePng does not check CRCs, Chrome's are always right.
  const png = encodePng(img);
  const ihdrEnd = 8 + 12 + 13;
  const idat = deflateSync(out);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(idat.length, 0);
  return Buffer.concat([png.subarray(0, ihdrEnd), length, Buffer.from('IDAT'), idat, Buffer.alloc(4), png.subarray(png.length - 12)]);
}

describe('decodePng and encodePng', () => {
  it('round-trips an image byte for byte', () => {
    const img = image(5, 3);
    const back = decodePng(encodePng(img));
    expect(back).toMatchObject({ width: 5, height: 3, colorType: 6 });
    expect(back.raw.equals(img.raw)).toBe(true);
  });

  it.each([0, 1, 2, 3, 4])('undoes filter %i', (filter) => {
    const img = image(6, 4, filter);
    expect(decodePng(withFilter(img, filter)).raw.equals(img.raw)).toBe(true);
  });

  it('refuses what it cannot read rather than guessing', () => {
    expect(() => decodePng(Buffer.from('not a png at all'))).toThrow(/not a PNG/);
  });
});

describe('stitchPngs', () => {
  it('stacks tiles in order, top to bottom', () => {
    const top = image(4, 2, 1);
    const bottom = image(4, 3, 2);
    const out = decodePng(stitchPngs([encodePng(top), encodePng(bottom)]));
    expect(out).toMatchObject({ width: 4, height: 5 });
    expect(out.raw.equals(Buffer.concat([top.raw, bottom.raw]))).toBe(true);
  });

  it('refuses tiles of different widths', () => {
    expect(() => stitchPngs([encodePng(image(4, 1)), encodePng(image(5, 1))])).toThrow(/tiles differ/);
  });
});
