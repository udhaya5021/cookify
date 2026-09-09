"""Tiny static file server for local dev/preview.

Deliberately bypasses `python -m http.server`'s CLI entry point, which calls
os.getcwd() while building its argparse defaults — that call fails in some
sandboxed preview environments. Passing `directory=` directly to the handler
avoids it entirely.
"""
import os
import functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
PORT = 5510

if __name__ == "__main__":
    handler = functools.partial(SimpleHTTPRequestHandler, directory=DIRECTORY)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), handler)
    print(f"Serving {DIRECTORY} on port {PORT}")
    server.serve_forever()
