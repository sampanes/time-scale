import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = readFileSync(resolve(root, "index.html"), "utf8");
const entry = resolve(root, "src", "app.js");

function toPosix(path) {
  return path.split("\\").join("/");
}

function getTags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((match) => match[0]);
}

function getAttr(tag, attr) {
  const match = tag.match(new RegExp(`\\b${attr}=(?:"([^"]*)"|'([^']*)')`, "i"));
  return match?.[1] ?? match?.[2];
}

function getImportSpecifiers(source) {
  const pattern = /\b(?:import|export)\s+(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/g;
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

// Every module reachable from src/app.js through relative imports, as repo-relative paths.
function walkImportGraph(entryPath) {
  const seen = new Set();
  const queue = [entryPath];

  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);

    for (const specifier of getImportSpecifiers(readFileSync(file, "utf8"))) {
      if (specifier.startsWith(".")) queue.push(resolve(dirname(file), specifier));
    }
  }

  return [...seen].map((file) => `./${toPosix(relative(root, file))}`);
}

test("modulepreload hints match the real import graph from src/app.js", () => {
  const preloads = getTags(indexHtml, "link")
    .filter((tag) => getAttr(tag, "rel") === "modulepreload")
    .map((tag) => getAttr(tag, "href"));
  const graph = walkImportGraph(entry).filter((href) => href !== "./src/app.js");

  assert.equal(new Set(preloads).size, preloads.length, "a module is preloaded twice");
  assert.ok(!preloads.includes("./src/app.js"), "the entry is fetched by its own <script>, do not preload it");

  const missing = graph.filter((href) => !preloads.includes(href));
  const stale = preloads.filter((href) => !graph.includes(href));
  assert.deepEqual(missing, [], `imported but not preloaded: ${missing.join(", ")}`);
  assert.deepEqual(stale, [], `preloaded but not imported: ${stale.join(", ")}`);
});

test("the Google Fonts stylesheet does not block rendering", () => {
  const outsideNoscript = indexHtml.replace(/<noscript>[\s\S]*?<\/noscript>/gi, "");
  const fontLinks = getTags(outsideNoscript, "link").filter((tag) => /fonts\.googleapis\.com\/css/.test(getAttr(tag, "href") || ""));

  assert.equal(fontLinks.length, 1, "expected one Google Fonts link outside <noscript>");
  const [fontLink] = fontLinks;
  assert.equal(getAttr(fontLink, "rel"), "preload", "fonts link must start as rel=preload, not rel=stylesheet");
  assert.equal(getAttr(fontLink, "as"), "style");
  assert.match(getAttr(fontLink, "onload") || "", /rel\s*=\s*'stylesheet'/, "onload must swap the link to a stylesheet");
  assert.match(getAttr(fontLink, "href"), /display=swap/);

  const noscript = indexHtml.match(/<noscript>[\s\S]*?<\/noscript>/i)?.[0] || "";
  assert.match(noscript, /rel="stylesheet"[^>]*fonts\.googleapis\.com|fonts\.googleapis\.com[^>]*rel="stylesheet"/, "<noscript> must carry the plain stylesheet fallback");
});
