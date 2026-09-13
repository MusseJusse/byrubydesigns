#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const MARK = "src/assets/brand/ruby-mark.webp";
const OG_SOURCE = "src/assets/artwork/paintings/painting-02.webp";
const OUT = "public";
const PAPER = { r: 232, g: 232, b: 229 };

const FAVICON_SIZES = [16, 32, 48];
const ICON_SIZES = [180, 192, 512];

function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = Buffer.alloc(16 * images.length);
  const parts = [];
  let offset = 6 + entries.length;

  images.forEach(({ size, data }, index) => {
    const entry = 16 * index;
    entries.writeUInt8(size >= 256 ? 0 : size, entry);
    entries.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    entries.writeUInt8(0, entry + 2);
    entries.writeUInt8(0, entry + 3);
    entries.writeUInt16LE(1, entry + 4);
    entries.writeUInt16LE(32, entry + 6);
    entries.writeUInt32LE(data.length, entry + 8);
    entries.writeUInt32LE(offset, entry + 12);
    offset += data.length;
    parts.push(data);
  });

  return Buffer.concat([header, entries, ...parts]);
}

const mark = await sharp(await fs.readFile(MARK)).trim().png().toBuffer();

async function icon(size, background) {
  const inner = Math.round(size * 0.86);
  const resized = await sharp(mark)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: background ? 3 : 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
  return canvas
    .composite([{ input: resized, gravity: "center" }])
    .png({ palette: true, colors: 128, effort: 10 })
    .toBuffer();
}

const favicons = await Promise.all(
  FAVICON_SIZES.map(async (size) => ({ size, data: await icon(size) })),
);

for (const { size, data } of favicons) {
  await fs.writeFile(path.join(OUT, `favicon-${size}.png`), data);
}

await fs.writeFile(
  path.join(OUT, "favicon.ico"),
  ico(favicons.filter(({ size }) => size <= 48)),
);

for (const size of ICON_SIZES) {
  const name = size === 180 ? "apple-touch-icon.png" : `favicon-${size}.png`;
  await fs.writeFile(path.join(OUT, name), await icon(size, PAPER));
}

const og = await sharp(OG_SOURCE)
  .resize(1200, 630, { fit: "cover", position: sharp.strategy.attention })
  .jpeg({ quality: 82, mozjpeg: true })
  .toBuffer();
await fs.writeFile(path.join(OUT, "og.jpg"), og);

await fs.rm(path.join(OUT, "favicon.webp"), { force: true });

const kb = (bytes) => `${Math.round(bytes / 1024)}KB`;
console.log(
  `favicons ${FAVICON_SIZES.join("/")}px, icons ${ICON_SIZES.join("/")}px, og.jpg ${kb(og.length)}`,
);
