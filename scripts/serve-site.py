from __future__ import annotations

import argparse
import errno
import functools
import http.server
import socket
from pathlib import Path


MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".map": "application/json; charset=utf-8",
}


class TimeScaleRequestHandler(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path: str) -> str:
        suffix = Path(path).suffix.lower()
        return MIME_TYPES.get(suffix, super().guess_type(path))

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:
        return


class ReusableThreadingHTTPServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()

    if not root.exists():
        print(f"Site root does not exist: {root}")
        print("Run `npm run build` first, or use `serve-site.bat`.")
        return 1

    handler = functools.partial(TimeScaleRequestHandler, directory=str(root))
    server, port = bind_server(handler, args.host, args.port)

    print(f"Serving {root}", flush=True)
    print(f"Local:   http://127.0.0.1:{port}/", flush=True)
    for address in get_lan_addresses():
        print(f"Network: http://{address}:{port}/", flush=True)
    print("Use a Network URL from your phone. Ctrl+C stops the server.", flush=True)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.", flush=True)
    finally:
        server.server_close()

    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve To Scale: Time with browser-safe MIME types.")
    parser.add_argument("--root", default="_site", help="Directory to serve.")
    parser.add_argument("--host", default="0.0.0.0", help="Host/interface to bind.")
    parser.add_argument("--port", default=8126, type=int, help="Preferred port. The server will try nearby ports if needed.")
    return parser.parse_args()


def bind_server(handler: type[http.server.SimpleHTTPRequestHandler], host: str, start_port: int):
    last_error: OSError | None = None

    for port in range(start_port, start_port + 50):
        try:
            return ReusableThreadingHTTPServer((host, port), handler), port
        except OSError as error:
            last_error = error
            if error.errno not in {errno.EADDRINUSE, errno.EACCES, 10013, 10048}:
                raise

    raise RuntimeError(f"Could not bind {host}:{start_port}-{start_port + 49}") from last_error


def get_lan_addresses() -> list[str]:
    addresses = set()

    try:
        hostname = socket.gethostname()
        for address in socket.gethostbyname_ex(hostname)[2]:
            if not address.startswith("127."):
                addresses.add(address)
    except OSError:
        pass

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            address = sock.getsockname()[0]
            if not address.startswith("127."):
                addresses.add(address)
    except OSError:
        pass

    return sorted(addresses)


if __name__ == "__main__":
    raise SystemExit(main())
