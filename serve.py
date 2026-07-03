"""Minimal static server for local dev: python serve.py (honors PORT env var)."""
import http.server
import os


class DevHandler(http.server.SimpleHTTPRequestHandler):
    """Static handler that disables caching so edits show up on every reload."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()


port = int(os.environ.get("PORT", 8000))
print(f"Serving on http://127.0.0.1:{port}")
http.server.ThreadingHTTPServer(("127.0.0.1", port), DevHandler).serve_forever()
