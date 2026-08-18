#!/usr/bin/env python3
"""Assemble les sources de src/ en un fichier unique publiable comme artefact.

Le fichier produit ne contient volontairement ni <!doctype>, ni <html>, ni <head>,
ni <body> : l'outil Artifact fournit ce squelette au moment de la publication.

Ordre de concatenation : ordre alphabetique des noms de fichiers, d'ou les
prefixes numeriques. Le CSS est injecte dans <style>, le HTML tel quel, le JS
dans un <script> unique enveloppe dans une IIFE.
"""

import pathlib
import re
import sys

RACINE = pathlib.Path(__file__).parent
SRC = RACINE / "src"
DIST = RACINE / "dist"
SORTIE = DIST / "potentia-loan.html"

INTERDITS = [
    (re.compile(r"""<script[^>]+src=["']https?:""", re.I), "script externe"),
    (re.compile(r"""<link[^>]+href=["']https?:""", re.I), "feuille de style externe"),
    (re.compile(r"""@import\s+url\(["']?https?:""", re.I), "@import distant"),
    (re.compile(r"\bfetch\s*\(\s*[\"']https?:", re.I), "appel fetch distant"),
    (re.compile(r"\bnew\s+WebSocket\b", re.I), "WebSocket"),
    (re.compile(r"\bXMLHttpRequest\b"), "XMLHttpRequest"),
]


def lire(chemin):
    return chemin.read_text(encoding="utf-8")


def main():
    if not SRC.is_dir():
        sys.exit("src/ introuvable")

    fichiers = sorted(SRC.iterdir(), key=lambda p: p.name)
    css, html, js = [], [], []

    for f in fichiers:
        if f.suffix == ".css":
            css.append("/* === %s === */\n%s" % (f.name, lire(f)))
        elif f.suffix == ".html":
            html.append("<!-- === %s === -->\n%s" % (f.name, lire(f)))
        elif f.suffix == ".js":
            js.append("/* === %s === */\n%s" % (f.name, lire(f)))

    if not html:
        sys.exit("aucun markup dans src/")

    page = "\n".join([
        '<meta charset="utf-8">',
        "<title>Potentia Loan — État des lieux & inventaire</title>",
        "<style>",
        "\n\n".join(css),
        "</style>",
        "\n\n".join(html),
        "<script>",
        '"use strict";',
        "(function () {",
        "var PL = (window.PL = window.PL || {});",
        "\n\n".join(js),
        "})();",
        "</script>",
        "",
    ])

    for motif, libelle in INTERDITS:
        trouve = motif.search(page)
        if trouve:
            sys.exit("ressource interdite (%s) : %r" % (libelle, trouve.group(0)))

    DIST.mkdir(exist_ok=True)
    SORTIE.write_text(page, encoding="utf-8")

    octets = len(page.encode("utf-8"))
    print("ecrit %s  (%d fichiers, %.1f Ko)" % (SORTIE, len(fichiers), octets / 1024))


if __name__ == "__main__":
    main()
