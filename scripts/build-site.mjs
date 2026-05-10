import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = resolve(root, "_site");

await rm(siteDir, { recursive: true, force: true });
await mkdir(siteDir, { recursive: true });

await cp(resolve(root, "index.html"), resolve(siteDir, "index.html"));
await cp(resolve(root, "to-scale-time.html"), resolve(siteDir, "to-scale-time.html"));
await cp(resolve(root, "assets"), resolve(siteDir, "assets"), { recursive: true });
await cp(resolve(root, "src"), resolve(siteDir, "src"), { recursive: true });
await writeFile(resolve(siteDir, ".nojekyll"), "");

console.log("Built _site");
