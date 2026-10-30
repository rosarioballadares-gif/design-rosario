/**
 * PNGs stacked top to bottom into one, with nothing but `node:zlib`.
 *
 * `shot.mjs --full` needs it because Chrome will not capture a page taller
 * than about 6.900 pixels in one piece: past that, headless Chrome repeats
 * the top of the page instead of drawing the rest — measured on 2026-10-08 on
 * a 13.657-pixel story whose DOM held its heading once and whose capture held
 * it twice. So the page is captured in tiles and the tiles are stitched here.
 *
 * It reads what Chrome writes: 8-bit RGB or RGBA, not interlaced. Anything
 * else throws rather than producing a picture that is quietly wrong.
 *
 * Brief: briefs/2026-10-08-user-hooks.md
 */
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 2: 3, 6: 4 };

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** `{ width, height, colorType, raw }`, raw being the unfiltered rows, top to bottom. */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  for (let at = 8; at < buf.length; ) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString('ascii', at + 4, at + 8);
    const data = buf.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
      if (data[8] !== 8 || !CHANNELS[colorType] || data[12] !== 0) {
        throw new Error(`unsupported PNG: bit depth ${data[8]}, colour type ${colorType}, interlace ${data[12]}`);
      }
    }
    if (type === 'IDAT') idat.push(data);
    at += 12 + length;
  }
  const bpp = CHANNELS[colorType];
  const stride = width * bpp;
  const filtered = inflateSync(Buffer.concat(idat));
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = filtered[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const out = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? raw[out + x - bpp] : 0;
      const b = y > 0 ? raw[out - stride + x] : 0;
      const c = x >= bpp && y > 0 ? raw[out - stride + x - bpp] : 0;
      const value = filtered[src + x];
      const predicted = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : filter === 4 ? paeth(a, b, c) : NaN;
      if (Number.isNaN(predicted)) throw new Error(`unknown PNG filter ${filter} on row ${y}`);
      raw[out + x] = (value + predicted) & 0xff;
    }
  }
  return { width, height, colorType, raw };
}

/** A PNG from unfiltered rows, each written with filter 0. */
export function encodePng({ width, height, colorType, raw }) {
  const stride = width * CHANNELS[colorType];
  const filtered = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) raw.copy(filtered, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(filtered)), chunk('IEND', Buffer.alloc(0))]);
}

/** The PNGs one under the other. They must share width and colour type. */
export function stitchPngs(buffers) {
  const images = buffers.map(decodePng);
  const [first] = images;
  for (const image of images) {
    if (image.width !== first.width || image.colorType !== first.colorType) {
      throw new Error(`tiles differ: ${image.width}px type ${image.colorType} against ${first.width}px type ${first.colorType}`);
    }
  }
  return encodePng({
    width: first.width,
    height: images.reduce((sum, image) => sum + image.height, 0),
    colorType: first.colorType,
    raw: Buffer.concat(images.map((image) => image.raw)),
  });
}
