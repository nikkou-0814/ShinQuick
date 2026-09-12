import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const outputDirectory = join(process.cwd(), "public", "maplibre-gl");
const assets = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

await mkdir(outputDirectory, { recursive: true });

for (const asset of assets) {
  const source = require.resolve(`maplibre-gl/dist/${asset}`);
  await copyFile(source, join(outputDirectory, asset));
}
