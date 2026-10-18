#!/usr/bin/env python3
"""Servidor local do MyPanel.

Serve os arquivos do painel em http://localhost:5500 e busca a agenda do Google
(endereço secreto no formato iCal), que o navegador não consegue baixar direto
por causa do bloqueio de CORS do Google.

Só usa a biblioteca padrão do Python 3. Nada é gravado em disco: o endereço da
agenda fica salvo apenas no navegador e chega aqui a cada atualização.

Uso:  python server.py            (abre o navegador)
      python server.py --no-browser
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

HOST = "127.0.0.1"
PORT = int(os.environ.get("MYPANEL_PORT", "5500"))
ROOT = os.path.dirname(os.path.abspath(__file__))

# Só endereços de agenda do Google: o servidor não funciona como proxy aberto.
ALLOWED_HOSTS = {"calendar.google.com", "www.google.com"}
CACHE_SECONDS = 120
MAX_BYTES = 10 * 1024 * 1024
_cache = {}


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".md": "text/markdown; charset=utf-8",
    }

    def end_headers(self):
        # Sem cache: depois de um "git pull" o navegador já pega a versão nova.
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # mantém a janela limpa

    # ---------- arquivos ----------
    def do_GET(self):
        path = urlsplit(self.path).path
        if any(part.startswith(".") for part in path.split("/") if part):
            return self.send_error(404)  # não expõe .git, .claude etc.
        return super().do_GET()

    def do_HEAD(self):
        return self.do_GET()

    # ---------- agenda ----------
    def do_POST(self):
        if urlsplit(self.path).path != "/api/ics":
            return self.send_error(404)

        # Só aceita chamadas feitas pela própria página do painel.
        host = self.headers.get("Host", "")
        origin = self.headers.get("Origin", "")
        if host not in (f"localhost:{PORT}", f"127.0.0.1:{PORT}"):
            return self._json(403, {"error": "forbidden"})
        if origin and urlsplit(origin).netloc != host:
            return self._json(403, {"error": "forbidden"})
        if self.headers.get_content_type() != "application/json":
            return self._json(415, {"error": "bad_request"})

        try:
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0 or length > 4096:
                raise ValueError
            url = str(json.loads(self.rfile.read(length)).get("url", "")).strip()
        except (ValueError, json.JSONDecodeError, AttributeError):
            return self._json(400, {"error": "bad_request"})

        if url.lower().startswith("webcal://"):
            url = "https://" + url[len("webcal://"):]
        parts = urlsplit(url)
        if parts.scheme != "https" or (parts.hostname or "").lower() not in ALLOWED_HOSTS:
            return self._json(400, {"error": "invalid_url"})

        cached = _cache.get(url)
        if cached and time.time() - cached[0] < CACHE_SECONDS:
            body = cached[1]
        else:
            req = urllib.request.Request(url, headers={"User-Agent": "MyPanel/1.0 (agenda local)"})
            try:
                with urllib.request.urlopen(req, timeout=15) as resp:
                    body = resp.read(MAX_BYTES + 1)
            except urllib.error.HTTPError as err:
                return self._json(502, {"error": "upstream", "status": err.code})
            except (urllib.error.URLError, TimeoutError, OSError):
                return self._json(504, {"error": "offline"})
            if len(body) > MAX_BYTES:
                return self._json(502, {"error": "too_large"})
            if not body.lstrip(b"\xef\xbb\xbf \r\n\t").startswith(b"BEGIN:VCALENDAR"):
                return self._json(502, {"error": "not_ical"})
            _cache[url] = (time.time(), body)

        self.send_response(200)
        self.send_header("Content-Type", "text/calendar; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    open_browser = "--no-browser" not in sys.argv
    url = f"http://localhost:{PORT}/"
    try:
        server = ThreadingHTTPServer((HOST, PORT), partial(Handler, directory=ROOT))
    except OSError:
        print(f"A porta {PORT} já está em uso. O painel provavelmente já está aberto em {url}")
        if open_browser:
            webbrowser.open(url)
        return

    print(f"MyPanel rodando em {url}")
    print("Feche esta janela (ou aperte Ctrl+C) para parar o servidor.")
    if open_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
