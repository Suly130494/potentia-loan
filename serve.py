#!/usr/bin/env python3
"""Serveur de test local. http.server ne declare pas le charset sur les .html,
ce qui casse l'affichage des accents et fausserait la verification."""

import functools
import http.server
import pathlib
import sys

DIST = pathlib.Path(__file__).parent / "dist"


class Handler(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        type_ = super().guess_type(path)
        if type_ in ("text/html", "text/plain", "text/css", "application/javascript"):
            return type_ + "; charset=utf-8"
        return type_

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8731
    handler = functools.partial(Handler, directory=str(DIST))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    print("http://127.0.0.1:%d/potentia-loan.html" % port, flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
