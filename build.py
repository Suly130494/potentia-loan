#!/usr/bin/env python3
"""Assemble les sources de src/ en un fichier unique publiable comme artefact.

Le fichier produit ne contient volontairement ni <!doctype>, ni <html>, ni <head>,
ni <body> : l'outil Artifact fournit ce squelette au moment de la publication.

Ordre de concatenation : ordre alphabetique des noms de fichiers, d'ou les
prefixes numeriques. Le CSS est injecte dans <style>, le HTML tel quel, le JS
dans un <script> unique enveloppe dans une IIFE.
"""

import hashlib
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

    ecrire_site(page)


def ecrire_site(page):
    """Version autonome pour un hebergement statique (GitHub Pages).

    Le fichier de dist/ est un fragment : l'outil Artifact fournit le squelette.
    Servi tel quel par un hebergeur, il n'aurait ni viewport (page rendue a
    980 px sur mobile) ni langue declaree. On genere donc une page complete,
    plus un service worker sans lequel un rechargement hors reseau echouerait.
    """
    empreinte = hashlib.sha256(page.encode("utf-8")).hexdigest()[:12]

    index = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Etat des lieux et inventaire des meubles : constat locatif sur tablette, hors ligne, impression A4.">
<meta name="theme-color" content="#f4f5f6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#131518" media="(prefers-color-scheme: dark)">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Potentia Loan">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon.svg">
%s
</head>
<body>
%s
<script>
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {
      /* hors ligne indisponible : l'application reste utilisable en ligne */
    });
  });
}
</script>
</body>
</html>
""" % (extraire(page, "<style>", "</style>", inclus=True) + "\n" +
       extraire(page, "<title>", "</title>", inclus=True),
       corps(page))

    (RACINE / "index.html").write_text(index, encoding="utf-8")

    (RACINE / "sw.js").write_text("""/* Genere par build.py — ne pas editer a la main. */
var CACHE = "potentia-loan-%s";
var FICHIERS = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(FICHIERS);
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.map(function (k) {
      if (k !== CACHE) return caches.delete(k);
    }));
  }).then(function () { return self.clients.claim(); }));
});

/* Reseau d'abord, cache en secours : une nouvelle version est prise en
   compte des qu'il y a du reseau, et la visite fonctionne sans. */
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(function (rep) {
      var copie = rep.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copie); });
      return rep;
    }).catch(function () {
      return caches.match(e.request).then(function (r) {
        return r || caches.match("./index.html");
      });
    })
  );
});
""" % empreinte, encoding="utf-8")

    (RACINE / "manifest.webmanifest").write_text("""{
  "name": "Potentia Loan — Etat des lieux",
  "short_name": "Potentia Loan",
  "description": "Constat locatif sur tablette : etat des lieux et inventaire meuble.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#f4f5f6",
  "theme_color": "#f4f5f6",
  "lang": "fr",
  "icons": [
    { "src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }
  ]
}
""", encoding="utf-8")

    (RACINE / "icon.svg").write_text("""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="10" fill="#16181a"/>
  <rect x="12" y="12" width="40" height="40" rx="5" fill="none" stroke="#ffffff" stroke-width="3.5"/>
  <path d="M23 43V21h8.6a6.8 6.8 0 0 1 0 13.6H28" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="square"/>
  <path d="M35 43h7" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="square"/>
</svg>
""", encoding="utf-8")

    print("ecrit index.html + sw.js + manifest.webmanifest + icon.svg  (empreinte %s)" % empreinte)


def extraire(texte, debut, fin, inclus=False):
    i = texte.index(debut)
    j = texte.index(fin) + len(fin)
    return texte[i:j] if inclus else texte[i + len(debut):j - len(fin)]


def retirer(texte, debut, fin):
    i = texte.index(debut)
    j = texte.index(fin) + len(fin)
    return texte[:i] + texte[j:]


def corps(page):
    """Le fragment destine a l'artefact porte en tete des elements qui
    appartiennent au <head> d'une page complete. On les en retire."""
    t = retirer(page, "<style>", "</style>")
    t = retirer(t, "<title>", "</title>")
    t = t.replace('<meta charset="utf-8">', "", 1)
    return t.strip()


if __name__ == "__main__":
    main()
