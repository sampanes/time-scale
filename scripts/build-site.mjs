import { existsSync } from "node:fs";
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

// Fail the build when a modulepreload hint points at a file that did not ship.
const builtHtml = await readFile(resolve(siteDir, "index.html"), "utf8");
const preloadHrefs = [...builtHtml.matchAll(/<link\b[^>]*\brel=["']modulepreload["'][^>]*>/gi)]
  .map((match) => match[0].match(/\bhref=["']([^"']+)["']/i)?.[1])
  .filter((href) => href && !/^[a-z][a-z0-9+.-]*:|^\/\//i.test(href));
const missingPreloads = preloadHrefs.filter((href) => {
  const path = resolve(siteDir, href.replace(/[?#].*$/, ""));
  return !path.startsWith(siteDir) || !existsSync(path);
});

if (missingPreloads.length > 0) {
  console.error(`Build failed: modulepreload targets missing from _site: ${missingPreloads.join(", ")}`);
  process.exit(1);
}

console.log(`Built _site with cache-buster v=${commitHash} (${preloadHrefs.length} modulepreload hints checked)`);
