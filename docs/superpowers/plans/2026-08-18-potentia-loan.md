# Potentia Loan — Plan d'implémentation

> **Pour les agents :** ce plan s'exécute tâche par tâche. Chaque tâche se termine par une vérification navigateur réelle (Playwright sur `dist/potentia-loan.html`), pas par une affirmation.

**Goal :** livrer une page web autonome, tablette-first, qui remplace la saisie papier de l'état des lieux et de l'inventaire meublé, fonctionne hors ligne et imprime deux documents A4 propres.

**Architecture :** sources découpées par responsabilité dans `src/`, assemblées par `build.py` en un fichier unique `dist/potentia-loan.html` publiable comme artefact. Trois couches sans dépendance circulaire : store (persistance) → vues (saisie) → rendu impression (DOM A4 régénéré à la demande).

**Tech stack :** HTML/CSS/JavaScript natif, sans dépendance externe. `localStorage` pour les données, `IndexedDB` pour les photos, `window.print()` pour le PDF. Build en Python 3 (concaténation, sans minification).

## Contraintes globales

Ces contraintes s'appliquent à **toutes** les tâches :

- **Aucune ressource externe.** Pas de CDN, pas de police distante, pas de `fetch` réseau, pas de `<link href="http...">`. La CSP de l'artefact les bloque.
- **Le fichier publié ne contient ni `<!doctype>`, ni `<html>`, ni `<head>`, ni `<body>`** — l'outil Artifact fournit ce squelette. Le fichier commence par `<title>`, puis `<style>`, puis le markup, puis `<script>`.
- **Aucune donnée personnelle en dur.** Ni nom, ni adresse, ni téléphone, ni valeur d'exemple pré-remplie. L'application démarre vierge.
- **Branding :** produit = `Potentia Loan`. Éditeur = `Potentia Digital`, mention « Édité par Potentia Digital ». Jamais dans le corps des documents imprimés, uniquement en pied de page.
- **Direction visuelle : neutre administratif.** Palette limitée à des gris et du noir, un seul gris d'accent pour les en-têtes de tableau. Aucune ombre portée, aucun dégradé, aucune couleur saturée hors états d'erreur.
- **Échelles d'état, jamais interchangées :** bâti = `N` / `B` / `M`. Mobilier = `TB` / `B` / `P` / `M`.
- **Accessibilité :** cibles tactiles ≥ 44 px, contraste AA, `<label>` sur chaque champ, groupes d'états en `role="radiogroup"`, `aria-label` sur les boutons icône.
- **Thème :** l'écran gère clair et sombre (`prefers-color-scheme` + surcharge `:root[data-theme]`). L'impression est toujours en clair.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `build.py` | Assemble `src/` → `dist/potentia-loan.html`. Aucune logique métier. |
| `src/00-shell.html` | Markup statique : en-tête applicatif, conteneur de vue, barre d'actions, dialogues. |
| `src/10-screen.css` | Styles écran : mise en page responsive, composants de saisie, thème clair/sombre. |
| `src/20-print.css` | Styles impression : A4, sauts de page, en-têtes de tableau répétés, pied de page. |
| `src/30-defaults.js` | Listes par défaut issues des modèles papier + fabrique de dossier vierge. Données pures, aucune logique. |
| `src/40-store.js` | État, auto-save, `localStorage`, export/import JSON, migration de schéma. Ne touche pas au DOM. |
| `src/45-photos.js` | IndexedDB, compression `<canvas>`, quota. Interface asynchrone. |
| `src/50-ui.js` | Helpers DOM, routeur de vues, composants réutilisables (segmenté, champ, dialogue). |
| `src/60-view-home.js` | Écran d'accueil : liste des dossiers, création, import, archivage. |
| `src/61-view-identite.js` | Logement, bailleur, locataire, campagne. |
| `src/62-view-edl.js` | Compteurs, chauffage, divers, pièces, équipements. |
| `src/63-view-mobilier.js` | Sections et lignes d'inventaire. |
| `src/64-view-signature.js` | Signatures tactiles, verrouillage, contrôle de complétion. |
| `src/70-print.js` | Génération du DOM A4 des trois documents + récapitulatif des écarts. |
| `src/90-app.js` | Bootstrap, hub, navigation, jauge de stockage. |

L'ordre des préfixes numériques est l'ordre de concaténation. Chaque fichier ne dépend que de ceux qui le précèdent.

---

## Interfaces publiques

Verrouillées ici pour que chaque tâche connaisse les signatures exactes des autres.

```js
// 30-defaults.js
PL.DEFAULTS.pieces        // [{ nom }]
PL.DEFAULTS.sections      // [{ titre, lignes: [libelle] }]
PL.DEFAULTS.equipements   // { cuisine: [], salleDEau: [], wc: [] }
PL.nouveauDossier()       // -> Dossier vierge complet
PL.SCHEMA_VERSION         // number

// 40-store.js
PL.store.list()                   // -> [{ id, titre, modifieLe, signe, avancement }]
PL.store.get(id)                  // -> Dossier | null
PL.store.create()                 // -> id
PL.store.patch(id, fn)            // fn(dossier) muté en place, sauvegarde + notifie
PL.store.remove(id)
PL.store.duplicate(id)            // -> id
PL.store.exportJSON(id)           // -> déclenche le téléchargement
PL.store.importJSON(text)         // -> { ok:true, id } | { ok:false, erreur }
PL.store.usage()                  // -> { octets, pourcent }
PL.store.onChange(cb)             // abonnement

// 45-photos.js  (toutes asynchrones)
PL.photos.put(file)               // compresse -> { id, largeur, hauteur, octets }
PL.photos.get(id)                 // -> dataURL | null
PL.photos.del(id)
PL.photos.disponible()            // -> bool (false en navigation privée)
PL.photos.usage()                 // -> octets

// 50-ui.js
PL.el(tag, props, ...enfants)     // -> HTMLElement
PL.segmente({ valeur, options, onChange, label })  // -> radiogroup
PL.champ({ label, valeur, onChange, type, suffixe })
PL.dialogue({ titre, corps, actions })
PL.router.go(nom, params)
PL.router.define(nom, rendu)
PL.toast(message)

// 70-print.js
PL.print.edl(dossier)             // -> DocumentFragment
PL.print.mobilier(dossier)
PL.print.ecarts(dossier)          // -> fragment ou null si aucun écart
PL.print.lancer(type)             // 'edl' | 'mobilier' | 'complet'
PL.print.calculerEcarts(dossier)  // -> [{ zone, libelle, entree, sortie, obs, photos }]
```

**Convention de campagne :** `mode` vaut `'entree'` ou `'sortie'`. Les champs d'état sont toujours nommés `etatEntree` / `etatSortie` (sans accent, pour éviter toute ambiguïté d'encodage dans les clés).

---

## Tâches

### Tâche 1 — Chaîne de build et squelette

**Fichiers :** créer `build.py`, `src/00-shell.html`, `src/10-screen.css`, `src/90-app.js`.

- [ ] `build.py` lit les fichiers de `src/` par ordre alphabétique, injecte le CSS dans `<style>`, le HTML tel quel, le JS dans un `<script>` unique enveloppé dans une IIFE exposant `window.PL`, écrit `dist/potentia-loan.html`.
- [ ] Le shell contient : `<title>Potentia Loan</title>`, en-tête applicatif avec logo SVG inline monochrome, `<main id="vue">`, pied de page « Édité par Potentia Digital ».
- [ ] `90-app.js` affiche « Potentia Loan » et la version dans `#vue`.
- [ ] Exécuter `python build.py`, ouvrir `dist/potentia-loan.html` dans Playwright, vérifier que le titre s'affiche et qu'aucune erreur console n'apparaît.

### Tâche 2 — Données par défaut

**Fichiers :** créer `src/30-defaults.js`.

- [ ] Transcrire **à l'identique** les listes de la spec §5 : 8 pièces, 7 sections de mobilier avec leurs lignes exactes, 3 blocs d'équipements, les 5 compteurs, les options de chauffage, les éléments « divers ».
- [ ] `PL.nouveauDossier()` retourne un dossier complet vierge : tous les champs texte à `''`, tous les états à `null`, identifiants générés via `crypto.randomUUID()`.
- [ ] Vérifier dans la console Playwright : `PL.nouveauDossier().mobilier.sections.length === 7`, `PL.DEFAULTS.pieces.length === 8`, et qu'aucune valeur de chaîne non vide autre que les libellés de structure n'existe dans l'objet.

### Tâche 3 — Store et persistance

**Fichiers :** créer `src/40-store.js`.

- [ ] Implémenter l'interface complète ci-dessus. Clé `localStorage` : `potentia-loan:v1`.
- [ ] `patch` sauvegarde immédiatement, met à jour `modifieLe`, notifie les abonnés.
- [ ] `importJSON` valide `schemaVersion` et la présence des clés racine ; en cas d'échec retourne `{ ok:false, erreur }` **sans écraser** l'existant.
- [ ] Gérer `QuotaExceededError` : ne perd rien, remonte une erreur explicite.
- [ ] Vérifier : créer un dossier, le modifier, recharger la page, contrôler la persistance. Exporter, effacer le `localStorage`, réimporter, comparer l'objet.

### Tâche 4 — Photos

**Fichiers :** créer `src/45-photos.js`.

- [ ] IndexedDB `potentia-loan-photos`, store `photos`, valeur = Blob JPEG.
- [ ] Compression : redimensionnement au plus grand côté 1280 px, JPEG qualité 0,72, via `<canvas>`.
- [ ] `disponible()` teste l'ouverture d'IndexedDB et retourne `false` proprement en navigation privée.
- [ ] Vérifier : injecter une image de test via Playwright, contrôler que la taille stockée est nettement inférieure à l'original et que `get()` retourne une dataURL affichable.

### Tâche 5 — Socle d'interface

**Fichiers :** créer `src/50-ui.js`, compléter `src/10-screen.css`.

- [ ] `PL.segmente` produit un `role="radiogroup"` navigable au clavier (flèches), cibles ≥ 44 px.
- [ ] Routeur par `hash`, avec retour arrière fonctionnel.
- [ ] Mise en page : deux colonnes ≥ 768 px, une colonne en dessous. Thème clair/sombre.
- [ ] Vérifier en 375 px et 768 px : aucun débordement horizontal, hauteur des cibles mesurée ≥ 44 px.

### Tâche 6 — Accueil et hub

**Fichiers :** créer `src/60-view-home.js`, compléter `src/90-app.js`.

- [ ] Liste vide au premier lancement, avec un état vide explicite.
- [ ] Actions : nouveau, ouvrir, dupliquer, importer, archiver, supprimer (avec confirmation).
- [ ] Hub : les 7 sections avec indicateur de complétion, jauge de stockage.
- [ ] Sélecteur de mode entrée / sortie.
- [ ] Vérifier : créer deux dossiers, les dupliquer, en supprimer un, contrôler la liste.

### Tâche 7 — Identité et état des lieux

**Fichiers :** créer `src/61-view-identite.js`, `src/62-view-edl.js`.

- [ ] Identité : logement, bailleur, locataire, date, lieu, nombre d'exemplaires.
- [ ] Compteurs avec unités et photo rattachée ; chauffage ; divers avec jeux de clés extensibles.
- [ ] Pièces : plafond / murs / sol, chaque ligne avec revêtement, état `N/B/M`, remarque, photos.
- [ ] Bouton « Tout en bon état » par pièce.
- [ ] Ajout, renommage, suppression, duplication de pièces.
- [ ] En mode sortie : état d'entrée affiché en lecture seule à côté, avec vignette de la photo d'entrée.
- [ ] Vérifier : saisir une pièce complète, ajouter une pièce personnalisée, recharger, contrôler.

### Tâche 8 — Inventaire mobilier

**Fichiers :** créer `src/63-view-mobilier.js`.

- [ ] Sections et lignes avec quantité, marqueur « absent » (Ø), état `TB/B/P/M`, observations, photos.
- [ ] Marquer « absent » neutralise et grise les sélecteurs d'état.
- [ ] Ajout, renommage, suppression de lignes et de sections.
- [ ] Mode sortie avec état d'entrée en regard.
- [ ] Vérifier : renseigner une section entière, marquer une ligne absente, contrôler la neutralisation.

### Tâche 9 — Signatures et verrouillage

**Fichiers :** créer `src/64-view-signature.js`.

- [ ] Deux `<canvas>` de signature gérant souris et tactile (`pointerdown/move/up`), bouton effacer.
- [ ] Alternative textuelle : saisie du nom si la signature tactile est impossible.
- [ ] Contrôle de complétion listant les champs vides, **sans bloquer**.
- [ ] Après signature : dossier en lecture seule, horodaté ; réouverture explicite signalée.
- [ ] Encart des délais légaux de réserve (10 jours ; premier mois de chauffe).
- [ ] Mention explicite : la signature tactile vaut commencement de preuve, pas signature qualifiée eIDAS.
- [ ] Vérifier : signer via Playwright, contrôler le verrouillage puis la réouverture.

### Tâche 10 — Impression

**Fichiers :** créer `src/70-print.js`, `src/20-print.css`.

- [ ] Trois sorties : état des lieux, inventaire, dossier complet (+ récapitulatif des écarts en mode sortie).
- [ ] `calculerEcarts` retourne uniquement les postes dégradés entre entrée et sortie, avec photos avant/après.
- [ ] Règles CSS de la spec §7 : A4, marges 12 mm, `break-inside: avoid` sur lignes et blocs, `thead` répété, pied de page répété, `orphans`/`widows`.
- [ ] Mention « document incomplet » tant que la signature manque.
- [ ] Vérifier via `emulateMedia('print')` dans Playwright, puis génération d'un PDF réel : contrôler le nombre de pages, l'absence de page blanche, la répétition des en-têtes.

### Tâche 11 — Vérification finale et publication

- [ ] Dérouler les 8 scénarios de la spec §11.
- [ ] Contrôler l'absence de toute donnée personnelle en dur dans `dist/potentia-loan.html`.
- [ ] Contrôler l'absence de toute référence réseau externe.
- [ ] Publier via l'outil Artifact et communiquer l'URL.

---

## Auto-revue

**Couverture de la spec :** §4 architecture → tâches 1, 3, 4, 5. §5 modèle de données → tâches 2, 3. §6 parcours → tâches 6 à 9. §7 impression → tâche 10. §8 identité visuelle → contraintes globales + tâches 1 et 5. §9 accessibilité → contraintes globales + tâche 5. §10 erreurs → tâches 3 et 4. §11 vérification → tâche 11. Aucune section sans tâche.

**Cohérence des noms :** `etatEntree` / `etatSortie` employés partout, sans accent. `PL.print.calculerEcarts` est bien la fonction consommée par `PL.print.ecarts`. Les préfixes de fichiers correspondent à l'ordre de concaténation attendu par `build.py`.
