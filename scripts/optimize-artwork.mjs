#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve("src/assets/artwork");
const MAX_EDGE = Number(process.env.MAX_EDGE ?? 1800);
const QUALITY = Number(process.env.QUALITY ?? 84);

async function* webpFiles(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* webpFiles(full);
    } else if (entry.name.endsWith(".webp")) {
      yield full;
    }
  }
}

let resized = 0;
let skipped = 0;
let beforeBytes = 0;
let afterBytes = 0;

for await (const file of webpFiles(ROOT)) {
  const original = await fs.readFile(file);
  const meta = await sharp(original).metadata();
  const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
  beforeBytes += original.length;

  if (longEdge <= MAX_EDGE) {
    skipped += 1;
    afterBytes += original.length;
    continue;
  }

  const output = await sharp(original)
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: QUALITY, effort: 6 })
    .toBuffer();

  await fs.writeFile(file, output);
  resized += 1;
  afterBytes += output.length;

  const next = await sharp(output).metadata();
  console.log(
    `${path.relative(ROOT, file)}  ${meta.width}x${meta.height} -> ${next.width}x${next.height}  ${Math.round(original.length / 1024)}KB -> ${Math.round(output.length / 1024)}KB`,
  );
}

const mb = (bytes) => `${(bytes / 1048576).toFixed(1)}MB`;
console.log(
  `\n${resized} resized, ${skipped} already within ${MAX_EDGE}px. ${mb(beforeBytes)} -> ${mb(afterBytes)}`,
);
