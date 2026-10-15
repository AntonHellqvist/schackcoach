"""Startar Schackcoach lokalt: python3 serve.py  ->  http://localhost:8642"""
import http.server
import os
import socketserver
import webbrowser
import sys

PORT = next((int(a) for a in sys.argv[1:] if a.isdigit()), 8642)
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".wasm": "application/wasm", ".js": "text/javascript"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *args):
        pass


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    url = f"http://localhost:{PORT}"
    print(f"Schackcoach körs på {url}  (avsluta med Ctrl+C)")
    if "--no-browser" not in sys.argv:
        webbrowser.open(url)
    httpd.serve_forever()
