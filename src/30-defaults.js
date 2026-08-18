/* ------------------------------------------------------------------
   Données par défaut, transcrites des deux modèles papier.
   Ce fichier ne contient que des données et des fabriques : aucune
   logique métier, aucun accès au DOM, aucune donnée personnelle.
   ------------------------------------------------------------------ */

PL.SCHEMA_VERSION = 1;

PL.uid = function () {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    try { return window.crypto.randomUUID(); } catch (e) { /* repli ci-dessous */ }
  }
  var t = Date.now().toString(36);
  var r = Math.random().toString(36).slice(2, 10);
  return t + "-" + r;
};

/* Échelles d'état — jamais interchangeables. */
PL.ETATS_BATI = [
  { code: "N", libelle: "Neuf" },
  { code: "B", libelle: "Bon" },
  { code: "M", libelle: "Mauvais" }
];

PL.ETATS_MOBILIER = [
  { code: "TB", libelle: "Très bon" },
  { code: "B", libelle: "Bon" },
  { code: "P", libelle: "Passable" },
  { code: "M", libelle: "Mauvais" }
];

/* Rang croissant = dégradation. Sert au calcul des écarts entrée/sortie. */
PL.RANG_BATI = { N: 0, B: 1, M: 2 };
PL.RANG_MOBILIER = { TB: 0, B: 1, P: 2, M: 3 };

PL.SUPPORTS = [
  { cle: "plafond", libelle: "Plafond" },
  { cle: "murs", libelle: "Murs" },
  { cle: "sol", libelle: "Sol" }
];

PL.REVETEMENTS = [
  "Peinture", "Papier peint", "Toile de verre", "Enduit", "Lambris",
  "Carrelage", "Faïence", "Moquette", "Parquet", "Stratifié", "Lino", "Béton ciré"
];

PL.DEFAULTS = {};

/* Pièces de l'état des lieux (le papier prévoit en plus des lignes libres,
   remplacées ici par « Ajouter une pièce »). */
PL.DEFAULTS.pieces = [
  "Entrée", "Salon", "Salle à manger", "Cuisine",
  "Chambre 1", "Chambre 2", "Salle d'eau", "WC"
];

PL.DEFAULTS.compteurs = [
  { cle: "eauFroide", libelle: "Eau froide", unite: "m³" },
  { cle: "eauChaude", libelle: "Eau chaude", unite: "m³" },
  { cle: "gaz", libelle: "Gaz", unite: "m³" },
  { cle: "elecHP", libelle: "Électricité — heures pleines", unite: "kWh" },
  { cle: "elecHC", libelle: "Électricité — heures creuses", unite: "kWh" }
];

PL.DEFAULTS.chauffageModes = ["Individuel", "Collectif"];
PL.DEFAULTS.chauffageEnergies = ["Gaz", "Fioul", "Électrique", "Pompe à chaleur", "Bois"];

PL.DEFAULTS.equipements = {
  cuisine: [
    "Évier", "Robinetterie", "Plaque(s) de cuisson", "Four", "Hotte",
    "Lave-vaisselle", "Réfrigérateur", "Machine à laver", "Luminaires"
  ],
  salleDEau: [
    "Lavabo", "Robinetterie lavabo", "Meuble vasque / miroir", "Douche",
    "Baignoire", "Robinetterie douche/bain", "Flexible", "Meuble de rangement",
    "Miroir fixe", "Luminaires"
  ],
  wc: [
    "Chasse d'eau", "Lunette et abattant", "Meuble de rangement", "Luminaire"
  ]
};

/* Sections de l'inventaire mobilier — annexe obligatoire du bail meublé. */
PL.DEFAULTS.sections = [
  {
    titre: "Séjour / Salle à manger",
    lignes: [
      "Canapé(s)", "Fauteuils", "Table basse", "Table repas", "Chaises",
      "Bibliothèque", "Buffet", "Meuble TV", "Lampes / Appliques"
    ]
  },
  {
    titre: "Chambre 1",
    lignes: [
      "Lit (dimensions en cm)", "Sommiers", "Matelas", "Protège-matelas",
      "Penderie / Armoire", "Table(s) de nuit"
    ]
  },
  {
    titre: "Chambre 2",
    lignes: [
      "Lit (dimensions en cm)", "Sommiers", "Matelas", "Protège-matelas",
      "Penderie / Armoire", "Table(s) de nuit"
    ]
  },
  {
    titre: "Salle(s) d'eau / bain",
    lignes: [
      "Rideau ou paroi de douche", "Meubles vasque",
      "Accessoires (porte-serviette, tapis, poubelles, etc.)"
    ]
  },
  {
    titre: "Électroménager complémentaire",
    lignes: [
      "Lave-linge", "Aspirateur", "Sèche-linge", "Lave-vaisselle",
      "Fer et planche à repasser"
    ]
  },
  {
    titre: "Cuisine",
    lignes: [
      "Réfrigérateur", "Congélateur", "Plaques de cuisson (nombre de feux)",
      "Four / Four micro-ondes", "Hotte", "Bouilloire", "Grille-pain", "Cafetière",
      "Casseroles", "Poêles", "Assiettes", "Verres", "Bols", "Tasses",
      "Autres éléments de vaisselle (à préciser en observations)", "Table(s)", "Chaises"
    ]
  },
  {
    titre: "Linge et divers",
    lignes: [
      "Couettes", "Oreillers", "Protège-oreillers", "Draps-housses",
      "Housses de couette", "Serviettes de toilette", "Torchons",
      "Ustensiles divers (ouvre-boîtes, tire-bouchon, etc.)"
    ]
  }
];

/* --- fabriques ------------------------------------------------------ */

function nouveauSupport() {
  return {
    revetement: "",
    etatEntree: null,
    etatSortie: null,
    remarqueEntree: "",
    remarqueSortie: ""
  };
}

PL.nouvellePiece = function (nom, supprimable) {
  var piece = {
    id: PL.uid(),
    nom: nom,
    supprimable: supprimable !== false,
    supports: {},
    photos: { entree: [], sortie: [] }
  };
  PL.SUPPORTS.forEach(function (s) { piece.supports[s.cle] = nouveauSupport(); });
  return piece;
};

PL.nouvelleLigne = function (libelle) {
  return {
    id: PL.uid(),
    libelle: libelle,
    qte: "",
    absent: false,
    etatEntree: null,
    etatSortie: null,
    observations: "",
    photos: { entree: [], sortie: [] }
  };
};

PL.nouvelleSection = function (titre, lignes) {
  return {
    id: PL.uid(),
    titre: titre,
    lignes: (lignes || []).map(PL.nouvelleLigne)
  };
};

function nouveauxCompteurs() {
  var c = { libres: [] };
  PL.DEFAULTS.compteurs.forEach(function (m) {
    c[m.cle] = { valeur: "", photos: [] };
  });
  return c;
}

function nouveauDivers() {
  return {
    cles: [{ id: PL.uid(), nombre: "", usage: "" }],
    detecteurs: { nombre: "", testRealise: false },
    receptionTV: "",
    boiteAuxLettres: false,
    sonnette: false,
    interphone: false,
    note: ""
  };
}

function nouvelleCampagne() {
  return {
    date: "",
    lieu: "",
    nbExemplaires: "2",
    nomBailleur: "",
    nomLocataire: "",
    signatureBailleur: "",
    signatureLocataire: "",
    signeLe: null,
    verrouille: false
  };
}

function nouveauxEquipements() {
  var out = {};
  Object.keys(PL.DEFAULTS.equipements).forEach(function (bloc) {
    out[bloc] = PL.DEFAULTS.equipements[bloc].map(function (libelle) {
      return {
        id: PL.uid(),
        libelle: libelle,
        presentEntree: false,
        presentSortie: false,
        precision: ""
      };
    });
  });
  return out;
}

PL.nouveauDossier = function () {
  var maintenant = new Date().toISOString();
  return {
    id: PL.uid(),
    schemaVersion: PL.SCHEMA_VERSION,
    creeLe: maintenant,
    modifieLe: maintenant,
    archive: false,
    logement: { adresse: "", batiment: "", escalier: "", etage: "", porte: "" },
    bailleur: { nom: "", adresse: "" },
    locataire: { nom: "", adresseEntree: "", adresseSortie: "" },
    campagnes: { entree: nouvelleCampagne(), sortie: nouvelleCampagne() },
    edl: {
      compteurs: { entree: nouveauxCompteurs(), sortie: nouveauxCompteurs() },
      chauffage: { mode: "", energie: "", nbRadiateurs: "", eauChaude: "", note: "" },
      divers: { entree: nouveauDivers(), sortie: nouveauDivers() },
      pieces: PL.DEFAULTS.pieces.map(function (nom) { return PL.nouvellePiece(nom, true); }),
      equipements: nouveauxEquipements()
    },
    mobilier: {
      sections: PL.DEFAULTS.sections.map(function (s) {
        return PL.nouvelleSection(s.titre, s.lignes);
      })
    },
    observations: { entree: "", sortie: "" }
  };
};
