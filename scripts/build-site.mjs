import { cp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = resolve(root, "_site");

let commitHash = "dev";
try {
  commitHash = execSync("git rev-parse --short HEAD").toString().trim();
} catch (e) {
  console.warn("Could not get git commit hash, using 'dev'");
}

await rm(siteDir, { recursive: true, force: true });
await mkdir(siteDir, { recursive: true });

// Process index.html for cache busting
let indexHtml = await readFile(resolve(root, "index.html"), "utf8");
indexHtml = indexHtml.replace('src="./src/app.js"', `src="./src/app.js?v=${commitHash}"`);
await writeFile(resolve(siteDir, "index.html"), indexHtml);

await cp(resolve(root, "to-scale-time.html"), resolve(siteDir, "to-scale-time.html"));
await cp(resolve(root, "assets"), resolve(siteDir, "assets"), { recursive: true });
await cp(resolve(root, "src"), resolve(siteDir, "src"), { recursive: true });
await writeFile(resolve(siteDir, ".nojekyll"), "");

console.log(`Built _site with cache-buster v=${commitHash}`);
