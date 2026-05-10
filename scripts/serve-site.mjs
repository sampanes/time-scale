import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const siteRoot = resolve(root, args.root ?? ".");
const host = args.host ?? "0.0.0.0";
const requestedPort = Number(args.port ?? 8000);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".txt", "text/plain; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
]);

start(requestedPort);

function start(port) {
  const server = createServer(handleRequest);

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" || error.code === "EACCES") {
      start(port + 1);
      return;
    }

    throw error;
  });

  server.listen(port, host, () => {
    const activePort = server.address().port;

    console.log(`Serving ${siteRoot}`);
    console.log(`Local:   http://127.0.0.1:${activePort}/`);
    for (const address of getLanAddresses()) {
      console.log(`Network: http://${address}:${activePort}/`);
    }
  });
}

async function handleRequest(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method Not Allowed");
    return;
  }

  try {
    const filePath = await resolveRequestPath(request.url);
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not Found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes.get(extname(filePath).toLowerCase()) ?? "application/octet-stream",
      "Content-Length": fileStat.size,
      "Cache-Control": "no-store",
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error.code === "ENOENT") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not Found");
      return;
    }

    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Internal Server Error");
    console.error(error);
  }
}

function getLanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((details) => details?.family === "IPv4" && !details.internal)
    .map((details) => details.address);
}

async function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const normalizedPath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const requestedPath = resolve(siteRoot, `.${normalizedPath}`);
  const relativePath = relative(siteRoot, requestedPath);

  if (relativePath.startsWith("..") || relativePath === "" || relativePath.split(sep).includes("..")) {
    const error = new Error("Forbidden path");
    error.code = "ENOENT";
    throw error;
  }

  return requestedPath;
}

function parseArgs(rawArgs) {
  const parsed = {};

  for (let index = 0; index < rawArgs.length; index++) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index++;
  }

  return parsed;
}
