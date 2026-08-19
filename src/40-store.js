/* ------------------------------------------------------------------
   Store : état des dossiers, auto-save, export/import.
   Ne connaît ni le DOM ni la mise en page.
   ------------------------------------------------------------------ */

(function () {
  var CLE = "potentia-loan:v1";
  var QUOTA_ESTIME = 5 * 1024 * 1024; /* borne basse usuelle de localStorage */

  var etat = { schemaVersion: PL.SCHEMA_VERSION, dossiers: {} };
  var abonnes = [];
  var derniereErreur = null;

  function charger() {
    var brut;
    try {
      brut = window.localStorage.getItem(CLE);
    } catch (e) {
      derniereErreur = "Stockage local indisponible. Les données ne seront pas conservées.";
      return;
    }
    if (!brut) return;
    try {
      var lu = JSON.parse(brut);
      if (lu && lu.dossiers) {
        etat.dossiers = lu.dossiers;
        etat.schemaVersion = lu.schemaVersion || PL.SCHEMA_VERSION;
      }
    } catch (e) {
      derniereErreur = "Données locales illisibles ; elles ont été conservées mais ignorées.";
    }
  }

  function sauver() {
    try {
      window.localStorage.setItem(CLE, JSON.stringify(etat));
      derniereErreur = null;
      return { ok: true };
    } catch (e) {
      var quota = e && (e.name === "QuotaExceededError" ||
        e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22);
      derniereErreur = quota
        ? "Stockage saturé : la dernière modification n'a pas pu être enregistrée. " +
          "Exportez puis archivez un dossier, ou supprimez des photos."
        : "Enregistrement impossible : " + (e && e.message ? e.message : "erreur inconnue");
      return { ok: false, erreur: derniereErreur };
    }
  }

  function notifier() {
    abonnes.forEach(function (cb) {
      try { cb(); } catch (e) { /* un abonné défaillant ne bloque pas les autres */ }
    });
  }

  /* --- progression ------------------------------------------------ */

  function compterSupports(dossier, mode) {
    var champ = mode === "sortie" ? "etatSortie" : "etatEntree";
    var total = 0, faits = 0;
    dossier.edl.pieces.forEach(function (p) {
      PL.SUPPORTS.forEach(function (s) {
        total++;
        if (p.supports[s.cle][champ]) faits++;
      });
    });
    return { total: total, faits: faits };
  }

  function compterMobilier(dossier, mode) {
    var champ = mode === "sortie" ? "etatSortie" : "etatEntree";
    var total = 0, faits = 0;
    dossier.mobilier.sections.forEach(function (sec) {
      sec.lignes.forEach(function (l) {
        total++;
        if (l.absent || l[champ]) faits++;
      });
    });
    return { total: total, faits: faits };
  }

  function compterRemplis(valeurs) {
    var total = valeurs.length, faits = 0;
    valeurs.forEach(function (v) { if (String(v == null ? "" : v).trim() !== "") faits++; });
    return { total: total, faits: faits };
  }

  PL.progression = function (dossier, mode) {
    var camp = dossier.campagnes[mode];
    var compteurs = dossier.edl.compteurs[mode];
    var identite = compterRemplis([
      dossier.logement.adresse, dossier.bailleur.nom, dossier.bailleur.adresse,
      dossier.locataire.nom, camp.date, camp.lieu
    ]);
    var compteursCpt = compterRemplis(PL.DEFAULTS.compteurs.map(function (m) {
      return compteurs[m.cle].valeur;
    }));
    var chauffage = compterRemplis([dossier.edl.chauffage.mode, dossier.edl.chauffage.energie]);
    var equipTotal = 0, equipFaits = 0;
    Object.keys(dossier.edl.equipements).forEach(function (bloc) {
      dossier.edl.equipements[bloc].forEach(function (eq) {
        equipTotal++;
        if (eq[mode === "sortie" ? "presentSortie" : "presentEntree"]) equipFaits++;
      });
    });
    var signatures = compterRemplis([
      camp.signatureBailleur || camp.nomBailleur,
      camp.signatureLocataire || camp.nomLocataire
    ]);

    var sections = {
      identite: identite,
      compteurs: compteursCpt,
      technique: chauffage,
      pieces: compterSupports(dossier, mode),
      equipements: { total: equipTotal, faits: equipFaits },
      mobilier: compterMobilier(dossier, mode),
      signatures: signatures
    };

    var total = 0, faits = 0;
    /* les équipements sont des cases facultatives : hors du calcul global */
    ["identite", "compteurs", "technique", "pieces", "mobilier", "signatures"]
      .forEach(function (k) { total += sections[k].total; faits += sections[k].faits; });

    sections.global = {
      total: total,
      faits: faits,
      pourcent: total ? Math.round((faits / total) * 100) : 0
    };
    return sections;
  };

  /* --- validation d'import ---------------------------------------- */

  function valider(objet) {
    if (!objet || typeof objet !== "object") return "Fichier illisible.";
    if (!objet.schemaVersion) return "Fichier non reconnu : version de schéma absente.";
    if (objet.schemaVersion > PL.SCHEMA_VERSION) {
      return "Ce dossier a été créé avec une version plus récente de Potentia Loan.";
    }
    var requis = ["logement", "bailleur", "locataire", "campagnes", "edl", "mobilier"];
    for (var i = 0; i < requis.length; i++) {
      if (!objet[requis[i]]) return "Structure incomplète : section « " + requis[i] + " » manquante.";
    }
    if (!Array.isArray(objet.edl.pieces) || !Array.isArray(objet.mobilier.sections)) {
      return "Structure incomplète : pièces ou sections d'inventaire absentes.";
    }
    return null;
  }

  /* Complète un dossier importé ou ancien avec les champs manquants,
     sans jamais écraser une valeur existante. */
  function migrer(dossier) {
    var modele = PL.nouveauDossier();
    function fusion(cible, ref) {
      Object.keys(ref).forEach(function (k) {
        if (cible[k] === undefined || cible[k] === null) {
          cible[k] = ref[k];
        } else if (
          typeof ref[k] === "object" && !Array.isArray(ref[k]) && ref[k] !== null &&
          typeof cible[k] === "object" && !Array.isArray(cible[k])
        ) {
          fusion(cible[k], ref[k]);
        }
      });
      return cible;
    }
    ["logement", "bailleur", "locataire", "campagnes", "observations"].forEach(function (k) {
      dossier[k] = fusion(dossier[k] || {}, modele[k]);
    });
    dossier.edl = fusion(dossier.edl || {}, {
      compteurs: modele.edl.compteurs,
      chauffage: modele.edl.chauffage,
      divers: modele.edl.divers,
      equipements: modele.edl.equipements
    });
    dossier.edl.pieces = (dossier.edl.pieces || []).map(function (p) {
      p.photos = p.photos || { entree: [], sortie: [] };
      p.supports = p.supports || {};
      PL.SUPPORTS.forEach(function (s) {
        p.supports[s.cle] = fusion(p.supports[s.cle] || {}, {
          revetement: "", etatEntree: null, etatSortie: null,
          remarqueEntree: "", remarqueSortie: ""
        });
      });
      if (!p.id) p.id = PL.uid();
      return p;
    });
    dossier.mobilier.sections.forEach(function (sec) {
      if (!sec.id) sec.id = PL.uid();
      sec.lignes = (sec.lignes || []).map(function (l) {
        l.photos = l.photos || { entree: [], sortie: [] };
        if (!l.id) l.id = PL.uid();
        return fusion(l, {
          libelle: "", qte: "", absent: false, etatEntree: null,
          etatSortie: null, observations: ""
        });
      });
    });
    dossier.schemaVersion = PL.SCHEMA_VERSION;
    return dossier;
  }

  /* --- titre lisible d'un dossier --------------------------------- */

  function titre(dossier) {
    var a = (dossier.logement.adresse || "").trim();
    if (a) return a.split("\n")[0];
    var l = (dossier.locataire.nom || "").trim();
    if (l) return "Dossier — " + l;
    return "Dossier sans adresse";
  }

  /* --- interface publique ------------------------------------------ */

  PL.store = {
    list: function () {
      return Object.keys(etat.dossiers)
        .map(function (id) {
          var d = etat.dossiers[id];
          return {
            id: id,
            titre: titre(d),
            locataire: (d.locataire.nom || "").trim(),
            modifieLe: d.modifieLe,
            archive: !!d.archive,
            signeEntree: !!d.campagnes.entree.signeLe,
            signeSortie: !!d.campagnes.sortie.signeLe,
            avancement: PL.progression(d, d.campagnes.sortie.signeLe ||
              d.campagnes.entree.signeLe ? "sortie" : "entree").global.pourcent
          };
        })
        .sort(function (a, b) { return (b.modifieLe || "").localeCompare(a.modifieLe || ""); });
    },

    get: function (id) { return etat.dossiers[id] || null; },

    create: function () {
      var d = PL.nouveauDossier();
      etat.dossiers[d.id] = d;
      sauver();
      notifier();
      return d.id;
    },

    patch: function (id, fn) {
      var d = etat.dossiers[id];
      if (!d) return { ok: false, erreur: "Dossier introuvable." };
      fn(d);
      d.modifieLe = new Date().toISOString();
      var res = sauver();
      notifier();
      return res;
    },

    remove: function (id) {
      var d = etat.dossiers[id];
      if (d && PL.photos) PL.photos.purgerDossier(d);
      delete etat.dossiers[id];
      sauver();
      notifier();
    },

    duplicate: function (id) {
      var src = etat.dossiers[id];
      if (!src) return null;
      var copie = JSON.parse(JSON.stringify(src));
      copie.id = PL.uid();
      copie.creeLe = copie.modifieLe = new Date().toISOString();
      copie.campagnes.entree.signeLe = null;
      copie.campagnes.entree.verrouille = false;
      copie.campagnes.entree.signatureBailleur = "";
      copie.campagnes.entree.signatureLocataire = "";
      copie.campagnes.sortie = JSON.parse(JSON.stringify(copie.campagnes.entree));
      etat.dossiers[copie.id] = copie;
      sauver();
      notifier();
      return copie.id;
    },

    /* Le fichier embarque les photos : sans elles, un dossier rouvert sur un
       autre appareil perdrait ses clichés d'entrée, et donc la comparaison
       avant/après du récapitulatif des écarts. */
    construireFichier: function (id) {
      var d = etat.dossiers[id];
      if (!d) return Promise.reject(new Error("Dossier introuvable."));

      var ids = PL.photos.idsDuDossier(d);
      return Promise.all(ids.map(function (pid) {
        return PL.photos.get(pid).then(function (data) {
          return data ? [pid, data] : null;
        });
      })).then(function (paires) {
        var copie = JSON.parse(JSON.stringify(d));
        copie.photosIncluses = {};
        paires.filter(Boolean).forEach(function (p) { copie.photosIncluses[p[0]] = p[1]; });

        var nom = "potentia-loan-" +
          titre(d).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) +
          ".json";
        return {
          nom: nom === "potentia-loan-.json" ? "potentia-loan.json" : nom,
          blob: new Blob([JSON.stringify(copie, null, 2)], { type: "application/json" }),
          photos: paires.filter(Boolean).length,
          titre: titre(d)
        };
      });
    },

    exportJSON: function (id) {
      return PL.store.construireFichier(id).then(function (f) {
        var url = URL.createObjectURL(f.blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = f.nom;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        return { ok: true, photos: f.photos, octets: f.blob.size, methode: "telechargement" };
      }).catch(function (e) {
        return { ok: false, erreur: e.message };
      });
    },

    /* Partage natif : le dossier part directement vers une messagerie, sans
       que l'utilisateur ait à retrouver un fichier dans ses téléchargements.
       Indisponible sur la plupart des navigateurs de bureau : on retombe
       alors sur le téléchargement, qui reste fonctionnel. */
    /* Chrome pour ordinateur expose navigator.share mais refuse les fichiers :
       tester la seule présence de l'API ferait annoncer « Envoyer » à un bouton
       qui télécharge. On teste donc la capacité réelle, avec un fichier témoin. */
    partageDisponible: function () {
      if (!navigator.share || !navigator.canShare) return false;
      try {
        return navigator.canShare({
          files: [new File(["{}"], "test.json", { type: "application/json" })]
        });
      } catch (e) {
        return false;
      }
    },

    partager: function (id) {
      return PL.store.construireFichier(id).then(function (f) {
        var fichier;
        try {
          fichier = new File([f.blob], f.nom, { type: "application/json" });
        } catch (e) {
          return PL.store.exportJSON(id);
        }
        if (!PL.store.partageDisponible() || !navigator.canShare({ files: [fichier] })) {
          return PL.store.exportJSON(id);
        }
        return navigator.share({
          files: [fichier],
          title: "Constat locatif — " + f.titre,
          text: "Dossier Potentia Loan « " + f.titre + " ». " +
            "Pour l'ouvrir : " + window.location.origin + window.location.pathname +
            " puis « Importer un JSON »."
        }).then(function () {
          return { ok: true, photos: f.photos, octets: f.blob.size, methode: "partage" };
        }).catch(function (e) {
          /* l'utilisateur a fermé la feuille de partage : ce n'est pas une erreur */
          if (e && e.name === "AbortError") return { ok: true, annule: true };
          return PL.store.exportJSON(id);
        });
      }).catch(function (e) {
        return { ok: false, erreur: e.message };
      });
    },

    importJSON: function (texte) {
      var objet;
      try {
        objet = JSON.parse(texte);
      } catch (e) {
        return { ok: false, erreur: "Ce fichier n'est pas un JSON valide." };
      }
      var erreur = valider(objet);
      if (erreur) return { ok: false, erreur: erreur };

      /* Photos embarquées : réinjectées dans IndexedDB sous leur identifiant
         d'origine, pour que les références du dossier restent valides. */
      var photos = objet.photosIncluses || {};
      delete objet.photosIncluses;
      var nbPhotos = Object.keys(photos).length;
      Object.keys(photos).forEach(function (pid) {
        PL.photos.restaurer(pid, photos[pid]);
      });

      var dossier = migrer(objet);
      if (!dossier.id || etat.dossiers[dossier.id]) dossier.id = PL.uid();
      dossier.modifieLe = new Date().toISOString();
      etat.dossiers[dossier.id] = dossier;
      var res = sauver();
      if (!res.ok) {
        delete etat.dossiers[dossier.id];
        return { ok: false, erreur: res.erreur };
      }
      notifier();
      return { ok: true, id: dossier.id, photos: nbPhotos };
    },

    usage: function () {
      var octets = 0;
      try {
        var brut = window.localStorage.getItem(CLE);
        octets = brut ? new Blob([brut]).size : 0;
      } catch (e) { octets = 0; }
      return {
        octets: octets,
        pourcent: Math.min(100, Math.round((octets / QUOTA_ESTIME) * 100))
      };
    },

    erreur: function () { return derniereErreur; },

    onChange: function (cb) {
      abonnes.push(cb);
      return function () {
        var i = abonnes.indexOf(cb);
        if (i >= 0) abonnes.splice(i, 1);
      };
    }
  };

  charger();
})();
