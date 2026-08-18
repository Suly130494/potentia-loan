# Potentia Loan

Outil de constat locatif tablette-first : **état des lieux** et **inventaire des meubles**
(annexe obligatoire au bail meublé, art. 25-8 de la loi n° 89-462), dans une page web
autonome qui fonctionne hors ligne.

**→ https://suly130494.github.io/potentia-loan/**

Édité par Potentia Digital.

## Ce que fait l'outil

- Un dossier unique par logement : l'en-tête logement / bailleur / locataire est saisi
  une fois et alimente les deux documents.
- Constat d'**entrée** puis constat de **sortie**, la sortie rappelant chaque état
  d'entrée en regard.
- **Récapitulatif des écarts** généré automatiquement : les seuls postes dégradés entre
  l'entrée et la sortie, avec photos avant / après. C'est la pièce qui sert à justifier
  une retenue sur dépôt de garantie.
- Photos compressées rattachées aux pièces, aux lignes d'inventaire et aux compteurs.
- Signatures tactiles bailleur et locataire, puis verrouillage du constat.
- Impression A4 : état des lieux, inventaire, dossier complet.
- Export / import du dossier en JSON, photos incluses.

L'outil démarre **vierge** : aucune donnée personnelle n'est codée en dur.

## Installation sur une tablette

Ouvrez le lien ci-dessus, puis « Ajouter à l'écran d'accueil » (menu du navigateur sur
Android, menu Partager sur iOS). L'outil s'ouvre alors en plein écran, comme une
application, et **fonctionne sans réseau** : un service worker met la page en cache au
premier chargement. Utile en cave, en sous-sol ou dans un logement sans couverture.

## Fonctionnement

Tout reste dans le navigateur de l'appareil : les données dans `localStorage`, les photos
dans `IndexedDB`. Aucun serveur, aucune requête réseau, aucun compte. La sauvegarde hors
appareil se fait par export d'un fichier JSON.

Conséquence à connaître : **effacer les données du navigateur efface les dossiers**.
Exportez un dossier terminé.

## Développement

Les sources sont découpées par responsabilité dans `src/` et assemblées en un fichier
unique publiable.

```bash
python build.py
```

Produit deux sorties depuis les mêmes sources :

- `dist/potentia-loan.html` — fragment sans `<html>` ni `<head>`, pour publication
  comme artefact Claude, qui fournit lui-même ce squelette.
- `index.html` + `sw.js` + `manifest.webmanifest` + `icon.svg` à la racine — page
  complète servie par GitHub Pages, avec `viewport`, langue déclarée et mise en cache
  hors ligne.

Le nom du cache du service worker dérive d'une empreinte du contenu : chaque build
invalide automatiquement l'ancienne version. Le build échoue volontairement si une ressource réseau
externe s'est glissée dans les sources.

Serveur de test local (nécessaire : `IndexedDB` est bloqué sur les origines `file://`) :

```bash
python serve.py
```

| Fichier | Rôle |
|---|---|
| `src/00-shell.html` | Markup statique |
| `src/10-screen.css` | Styles écran, thèmes clair et sombre |
| `src/20-print.css` | Feuille d'impression A4 |
| `src/30-defaults.js` | Listes reprises des modèles papier, fabrique de dossier vierge |
| `src/40-store.js` | État, persistance, export / import, migration de schéma |
| `src/45-photos.js` | Compression et stockage IndexedDB |
| `src/50-ui.js` | Composants, routeur, dialogues |
| `src/60-*` à `src/64-*` | Vues de saisie |
| `src/70-print.js` | Reconstruction du DOM A4 |
| `src/90-app.js` | Sommaire, routes, amorçage |

Le rendu d'impression ne réutilise jamais le DOM de saisie : il est reconstruit à partir
de l'état. C'est ce qui permet de maîtriser la pagination sans contraindre l'ergonomie
tactile.

La conception et le plan de réalisation sont dans `docs/superpowers/`.

## Limites assumées

- La numérotation « Page X sur Y » vient des en-têtes du navigateur : Chrome ne prend pas
  en charge les boîtes de marge `@page`.
- La signature tactile vaut commencement de preuve écrite, **pas** signature électronique
  qualifiée au sens du règlement eIDAS. Pour un constat contradictoire, imprimez et faites
  signer les exemplaires papier.
- Pas de grille de vétusté ni de chiffrage des retenues.
