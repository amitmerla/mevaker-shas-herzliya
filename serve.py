# Local static server for the page. Same as `python3 -m http.server`, but tells the browser not to cache,
# so after an edit the browser never mixes an old cached module (e.g. js/util.js) with new ones.
import http.server
import sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 4192
try:
    server = http.server.ThreadingHTTPServer(('', port), NoCache)
except OSError:
    sys.exit(f'Port {port} is already in use: the page is probably already being served. Open http://localhost:{port}')
print(f'Serving on http://localhost:{port} (no-cache)')
server.serve_forever()
