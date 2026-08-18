# Potentia Loan — État des lieux & inventaire meublé
## Document de conception

Date : 2026-08-18
Statut : implémenté et vérifié. Les écarts constatés en cours de réalisation ont été reportés ici.

---

## 1. Contexte

Deux documents papier sont aujourd'hui remplis à la main lors de chaque visite locative :

1. **`Modèle Etat des lieux.doc`** — état des lieux d'entrée : identité des parties, relevé de
   compteurs, chauffage, clés et équipements de sécurité, puis pour chaque pièce l'état du
   plafond, des murs et du sol (revêtement + note N/B/M), des blocs d'équipements cochables,
   observations et signatures.
2. **`modèle inventaire - format ODT.odt`** — inventaire et état des meubles, annexe obligatoire
   au bail meublé (art. 25-8 de la loi n° 89-462) : pour chaque section de mobilier, une
   quantité, un état d'entrée et un état de sortie (TB/B/P/M) et des observations.

Les deux documents partagent le même en-tête (logement, bailleur, locataire) et la même logique
« pièce → éléments → état ». Ils sont pourtant remplis séparément, ce qui impose une double
saisie et rend la comparaison entrée/sortie entièrement manuelle.

## 2. Objectif

Une **page web autonome**, pensée tablette d'abord, qui remplace la saisie papier des deux
documents, fonctionne hors ligne, et produit à l'impression deux documents A4 fidèles aux
modèles d'origine.

L'application est un outil **vierge** : aucune donnée personnelle, aucun nom de bailleur, aucune
adresse d'exemple n'est codé en dur. Elle est utilisable telle quelle par n'importe quel
bailleur ou gestionnaire.

### Critères de réussite

- Une visite d'entrée complète se saisit sur tablette sans clavier externe et sans réseau.
- L'en-tête (logement / bailleur / locataire) est saisi une seule fois pour les deux documents.
- L'impression produit un PDF sans ligne coupée en deux, sans page blanche, sans grande zone
  vide, et avec les en-têtes de tableau répétés en haut de chaque page.
- Une visite de sortie réutilise le dossier d'entrée et produit automatiquement la liste des
  écarts constatés.

### Non-objectifs

- Pas de grille de vétusté ni de chiffrage des retenues sur dépôt de garantie.
- Pas de synchronisation, de compte utilisateur ni de serveur.
- Pas de signature électronique qualifiée au sens eIDAS. La signature tactile vaut commencement
  de preuve ; l'application l'indique explicitement.
- Pas d'export Word/ODT. La sortie documentaire est l'impression PDF du navigateur.

## 3. Contraintes de la plateforme

L'application est publiée comme artefact : page unique, aucune ressource externe (pas de CDN,
pas de police distante, pas de requête réseau), tout doit être inline.

Conséquences assumées :

| Besoin | Solution retenue | Raison |
|---|---|---|
| Persistance des données | `localStorage` | Données textuelles légères, API synchrone, suffisant |
| Persistance des photos | `IndexedDB` (Blob) | `localStorage` plafonne à ~5 Mo ; IndexedDB autorise plusieurs centaines de Mo |
| Production du PDF | `window.print()` + feuille de style dédiée | Aucune bibliothèque externe possible ; le moteur d'impression du navigateur est fiable |
| Sauvegarde hors appareil | Export / import d'un fichier `.json`, **photos incluses** | Seul mécanisme de transfert possible sans serveur. Les photos sont embarquées en base64 : sans elles, un dossier rouvert sur une autre tablette perdrait ses clichés d'entrée, et donc la comparaison avant/après |
| Photos | `<input type="file" capture="environment">` + recompression `<canvas>` | Accès direct à l'appareil photo, sans permission spéciale |

## 4. Architecture

Trois couches, sans dépendance circulaire :

```
+---------------------------------------------------------+
|  STORE                                                  |
|  état du dossier · auto-save · localStorage + IndexedDB |
|  export/import JSON · migration de schéma               |
+---------------+-------------------------+---------------+
                |                         |
        +-------v--------+        +-------v--------------+
        |  VUES          |        |  RENDU IMPRESSION    |
        |  saisie tactile|        |  DOM A4 régénéré     |
        |  navigation    |        |  à la demande        |
        +----------------+        +----------------------+
```

**Point de conception central** : le rendu d'impression ne réutilise pas le DOM de saisie. Un
module dédié reconstruit un document A4 à partir du store au moment où l'utilisateur imprime.
C'est ce qui permet de garantir une mise en page propre sans compromis sur l'ergonomie de
saisie — les deux problèmes sont indépendants et traités séparément.

Chaque couche est isolée :

- **Store** — ne connaît ni le DOM ni la mise en page. Interface : `getDossier`, `patch`,
  `listDossiers`, `exportJSON`, `importJSON`, `putPhoto`, `getPhoto`, `storageUsage`.
- **Vues** — lisent le store et émettent des `patch`. Ne persistent rien directement.
- **Rendu impression** — lit le store, retourne un fragment DOM. Fonction pure de l'état.

## 5. Modèle de données

```
Dossier {
  id, créé le, modifié le, version de schéma
  logement   { adresse, bâtiment, escalier, étage, porte }
  bailleur   { nom, adresse }
  locataire  { nom, adresseEntrée, adresseSortie }
  campagnes  {
    entrée { date, lieu, nbExemplaires, signatureBailleur, signatureLocataire,
             signéLe, verrouillé }
    sortie { idem }
  }
  edl {
    compteurs   { eauFroide, eauChaude, gaz, élecHP, élecHC, libre[] }
    chauffage   { mode: individuel|collectif, énergie: gaz|fioul|électrique,
                  nbRadiateurs, eauChaude, note }
    divers      { jeuxDeClés[{ nombre, usage }], détecteursFumée{ nombre, testRéalisé },
                  réceptionTV, boîteAuxLettres, sonnette, interphone, note }
    pièces[]    { id, nom, supprimable,
                  plafond|murs|sol { revêtement, étatEntrée, étatSortie, remarque },
                  photos[] }
    équipements { cuisine[], salleDEau[], wc[] }
  }
  mobilier {
    sections[] { id, titre,
                 lignes[] { id, libellé, qté, absent, étatEntrée, étatSortie,
                            observations, photos[] } }
  }
  observations { entrée, sortie }
}
```

**Échelles d'état**, distinctes et non interchangeables :

- État des lieux (bâti) : `N` neuf · `B` bon · `M` mauvais
- Inventaire (mobilier) : `TB` très bon · `B` bon · `P` passable · `M` mauvais
- Une ligne d'inventaire peut être marquée **absente** (« Ø » sur le papier), ce qui neutralise
  les colonnes d'état.

**Photos** : la référence stockée dans le dossier est un identifiant ; le binaire vit dans
IndexedDB. Chaque photo porte une légende et un horodatage, et appartient à une campagne
(entrée ou sortie) — c'est ce qui permet l'affichage avant/après.

### Contenu par défaut d'un dossier vierge

Repris **à l'identique** des deux modèles papier. Toutes ces listes sont modifiables et
extensibles par l'utilisateur ; ce sont des valeurs initiales, pas une structure figée.

**Pièces de l'état des lieux** : Entrée · Salon · Salle à manger · Cuisine · Chambre 1 ·
Chambre 2 · Salle d'eau · WC. Le papier prévoit quatre lignes libres : elles deviennent un
bouton « Ajouter une pièce ».

**Relevé de compteurs** : eau froide (m³) · eau chaude (m³) · gaz (m³) · électricité heures
pleines (kWh) · électricité heures creuses (kWh) · lignes libres.

**Chauffage** : individuel ou collectif · gaz, fioul ou électrique · nombre de radiateurs ·
production d'eau chaude · note libre.

**Divers** : jeux de clés (nombre + usage, extensible) · détecteurs de fumée (nombre + test
réalisé) · réception télévision · boîte aux lettres · sonnette · interphone · note libre.

**Équipements cochables**
- Cuisine : évier · robinetterie · plaque(s) de cuisson (nombre) · four · hotte ·
  lave-vaisselle · réfrigérateur · machine à laver · luminaires
- Salle d'eau : lavabo · robinetterie · meuble vasque / miroir · douche · baignoire ·
  robinetterie · flexible · meuble de rangement · miroir fixe · luminaires
- WC : chasse d'eau · lunette et abattant · meuble de rangement · luminaire

**Sections de l'inventaire mobilier**
- Séjour / salle à manger : canapé(s) · fauteuils · table basse · table repas · chaises ·
  bibliothèque · buffet · meuble TV · lampes / appliques
- Chambre 1 et Chambre 2 : lit (dimensions en cm) · sommiers · matelas · protège-matelas ·
  penderie / armoire · table(s) de nuit
- Salle(s) d'eau / bain : rideau ou paroi de douche · meubles vasque · accessoires
  (porte-serviette, tapis, poubelles…)
- Électroménager complémentaire : lave-linge · aspirateur · sèche-linge · lave-vaisselle ·
  fer et planche à repasser
- Cuisine : réfrigérateur · congélateur · plaques de cuisson (nombre de feux) ·
  four / four micro-ondes · hotte · bouilloire · grille-pain · cafetière · casseroles ·
  poêles · assiettes · verres · bols · tasses · autres éléments de vaisselle · table(s) ·
  chaises
- Linge et divers : couettes · oreillers · protège-oreillers · draps-housses ·
  housses de couette · serviettes de toilette · torchons · ustensiles divers

## 6. Parcours utilisateur

### Écran d'accueil

Liste des dossiers (adresse, locataire, date, avancement, état signé ou non). Actions :
nouveau dossier, ouvrir, dupliquer, importer un `.json`, archiver, supprimer. Aucune donnée
préchargée : la liste est vide à la première ouverture.

### Hub du dossier

Sommaire des sections avec indicateur de complétion par section :

`Identité · Compteurs · Chauffage & divers · Pièces · Équipements · Inventaire mobilier ·
Signatures`

Navigation **hybride** : accès libre depuis le hub, plus un enchaînement
« précédent / suivant » à l'intérieur d'une section. Un parcours strictement linéaire casse dès
qu'une pièce est inaccessible pendant la visite ; un hub sans enchaînement impose un
aller-retour permanent au sommaire.

### Saisie

- Sélecteurs d'état en boutons segmentés larges (`N B M` / `TB B P M`), jamais de liste
  déroulante.
- Cibles tactiles ≥ 44 px, champs numériques déclenchant le pavé numérique.
- **« Tout en bon état » par pièce ou par section** : pré-remplit puis on ne corrige que les
  exceptions. Accélérateur déterminant sur un logement en bon état.
- Ajout, renommage, suppression et duplication de pièces et de lignes.
- Auto-save à chaque modification, avec indicateur d'enregistrement.
- Jauge d'occupation du stockage, visible dans les réglages du dossier.
- Photo du compteur rattachée au relevé.

### Mode sortie

Le dossier d'entrée est rouvert en mode sortie. Chaque ligne affiche l'état d'entrée **en
lecture seule à côté** du champ de saisie de sortie, avec la photo d'entrée en vignette. On ne
saisit que la sortie.

L'application calcule les écarts et produit un **récapitulatif des écarts** imprimable en
annexe : uniquement les postes dégradés, avec état d'entrée, état de sortie, observations et
photos avant/après côte à côte. Ce document n'existe pas sur le papier et doit être reconstitué
à la main aujourd'hui ; c'est la principale valeur ajoutée de l'outil.

### Signatures et verrouillage

Deux zones de signature tactile (bailleur, locataire) sur `<canvas>`, avec la mention
« Lu et approuvé », le lieu, la date et le nombre d'exemplaires originaux. Avant signature,
l'application affiche la liste de ce qui est resté vide — sans bloquer.

Après signature, le dossier passe en lecture seule et porte un horodatage. Une réouverture
explicite reste possible, signalée visuellement.

Un encart rappelle les délais légaux de réserve : dix jours après l'établissement de l'état des
lieux d'entrée, et le premier mois de la période de chauffe pour les éléments de chauffage.

## 7. Impression

Menu **Imprimer** à trois sorties, correspondant à trois pièces juridiquement distinctes :

1. État des lieux
2. Inventaire et état des meubles (annexe du bail meublé)
3. Dossier complet, et en mode sortie, le récapitulatif des écarts

### Règles de mise en page

- A4 portrait, marges 12 mm, feuille `@media print` dédiée.
- `break-inside: avoid` sur chaque ligne de tableau et chaque bloc de pièce → aucune ligne
  coupée entre deux pages.
- `thead { display: table-header-group }` → en-têtes de colonnes répétés en haut de chaque page.
- **Le titre de section est placé dans le `thead`**, pas dans un `<h2>` au-dessus : une page de continuation commence ainsi par « CHAMBRE 2 » et non par des lignes orphelines de leur section.
- Pied de page unique en `position: fixed`, réémis par le moteur d'impression sur chaque page, portant la référence du dossier et la mention d'édition. `bottom` doit rester dans la zone de contenu : une valeur négative décale le pied d'une page et fabrique une page fantôme.
- Photos en grille légendée en fin de section, calibrées pour ne pas provoquer de page
  quasi vide.
- Aucun élément d'interface imprimé ; rendu lisible en noir et blanc.
- `orphans` / `widows` réglés pour éviter les lignes isolées.

**Limite connue et assumée** : Chrome ne prend pas en charge les boîtes de marge `@page`, donc
la numérotation « Page X sur Y » ne peut pas être générée par le document. Elle est laissée aux
en-têtes du navigateur, activables dans la boîte de dialogue d'impression. Le reste de la mise
en page est entièrement maîtrisé par la feuille de style.

## 8. Identité visuelle

Direction retenue : **neutre administratif**.

- Quasi noir et blanc, un seul gris d'accent pour les en-têtes de tableau, aucun effet
  décoratif, aucune ombre portée. Contraste maximal, économie d'encre à l'impression.
- Typographie système, taille de base 16 px minimum, 11 pt à l'impression.
- **Potentia Loan** : nom du produit — en-tête de l'application, écran d'accueil, pied de page
  des documents imprimés.
- **Potentia Digital** : éditeur — mention discrète « Édité par Potentia Digital ».
- Logo SVG inline, monochrome.
- Le corps des documents imprimés reste strictement conforme aux modèles papier ; le branding
  n'apparaît qu'en pied de page.

## 9. Accessibilité

- Contrastes conformes AA (4,5:1 sur le texte).
- Cibles tactiles ≥ 44 px, y compris pour les actions secondaires. Seule exception : le bouton de suppression superposé à une miniature de photo, à 36 px — au-delà, il recouvrirait la vignette. Reste très au-dessus du minimum WCAG 2.5.8 (24 px).
- Navigation clavier complète, focus visible, ordre de tabulation cohérent.
- Chaque champ porte un `<label>` explicite ; les groupes d'états sont des `radiogroup` ARIA.
- Les boutons icône portent un `aria-label`.
- Les zones de signature offrent une alternative textuelle (nom saisi) pour qui ne peut pas
  signer au doigt.
- Mode sombre pris en charge à l'écran ; l'impression reste toujours en clair.

## 10. Gestion des erreurs

| Situation | Comportement |
|---|---|
| Quota de stockage atteint | Message explicite, proposition de supprimer des photos ou d'exporter puis archiver un dossier. Aucune perte silencieuse. |
| IndexedDB indisponible (navigation privée) | Photos désactivées avec avertissement clair ; la saisie textuelle reste pleinement fonctionnelle. |
| Import d'un JSON invalide ou d'une version antérieure | Validation puis migration de schéma ; en cas d'échec, refus explicite sans écraser l'existant. |
| Fermeture de l'onglet en cours de saisie | Aucune perte : l'auto-save est déclenché à chaque modification. |
| Impression avec dossier incomplet | Impression autorisée, avec la mention « document incomplet » en pied de page tant que la signature n'est pas apposée. |

## 11. Vérification

L'application n'ayant pas de chaîne de test automatisée (page autonome sans build), la
vérification est manuelle et doit être conduite explicitement avant livraison :

1. Créer un dossier, saisir un état des lieux d'entrée complet, fermer l'onglet, rouvrir →
   toutes les données sont restaurées.
2. Ajouter une pièce personnalisée et une ligne d'inventaire personnalisée, les renommer, les
   supprimer.
3. Prendre trois photos, vérifier leur compression et leur présence dans le PDF.
4. Signer, vérifier le verrouillage, rouvrir explicitement.
5. Imprimer les trois sorties et contrôler : aucune ligne coupée, aucune page blanche,
   en-têtes de tableau répétés, pied de page présent.
6. Exporter en JSON, vider le stockage du navigateur, réimporter → dossier identique.
7. Passer en mode sortie, dégrader trois postes, vérifier le récapitulatif des écarts.
8. Rejouer le parcours en 375 px de large (mobile) et en 768 px (tablette).

## 12. Livrables

1. Le fichier source dans `Potentia-loan/`, versionnable et modifiable.
2. La page publiée via l'outil Artifact.
