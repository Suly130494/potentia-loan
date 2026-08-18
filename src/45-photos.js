/* ------------------------------------------------------------------
   Photos : compression <canvas> + stockage IndexedDB.
   localStorage est trop étroit pour des images ; IndexedDB accepte
   plusieurs centaines de mégaoctets.
   ------------------------------------------------------------------ */

(function () {
  var NOM_BASE = "potentia-loan-photos";
  var MAGASIN = "photos";
  var COTE_MAX = 1280;
  var QUALITE = 0.72;

  var basePromesse = null;
  var supporte = true;
  var cache = {}; /* id -> dataURL, pour éviter de relire à chaque rendu */

  function ouvrir() {
    if (basePromesse) return basePromesse;
    basePromesse = new Promise(function (resoudre, rejeter) {
      if (!window.indexedDB) { supporte = false; rejeter(new Error("IndexedDB absent")); return; }
      var req;
      try {
        req = window.indexedDB.open(NOM_BASE, 1);
      } catch (e) { supporte = false; rejeter(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(MAGASIN)) {
          db.createObjectStore(MAGASIN, { keyPath: "id" });
        }
      };
      req.onsuccess = function () { resoudre(req.result); };
      req.onerror = function () { supporte = false; rejeter(req.error || new Error("IndexedDB refusé")); };
      req.onblocked = function () { rejeter(new Error("IndexedDB bloqué")); };
    });
    return basePromesse;
  }

  function transaction(mode, action) {
    return ouvrir().then(function (db) {
      return new Promise(function (resoudre, rejeter) {
        var tx = db.transaction(MAGASIN, mode);
        var magasin = tx.objectStore(MAGASIN);
        var resultat;
        try { resultat = action(magasin); } catch (e) { rejeter(e); return; }
        tx.oncomplete = function () {
          resoudre(resultat && resultat.result !== undefined ? resultat.result : resultat);
        };
        tx.onerror = function () { rejeter(tx.error); };
        tx.onabort = function () { rejeter(tx.error || new Error("Transaction interrompue")); };
      });
    });
  }

  function chargerImage(fichier) {
    if (window.createImageBitmap) {
      return window.createImageBitmap(fichier, { imageOrientation: "from-image" })
        .catch(function () { return chargerViaBalise(fichier); });
    }
    return chargerViaBalise(fichier);
  }

  function chargerViaBalise(fichier) {
    return new Promise(function (resoudre, rejeter) {
      var url = URL.createObjectURL(fichier);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resoudre(img); };
      img.onerror = function () { URL.revokeObjectURL(url); rejeter(new Error("Image illisible")); };
      img.src = url;
    });
  }

  function compresser(fichier) {
    return chargerImage(fichier).then(function (source) {
      var l = source.width || source.naturalWidth;
      var h = source.height || source.naturalHeight;
      if (!l || !h) throw new Error("Dimensions d'image inconnues");
      var ratio = Math.min(1, COTE_MAX / Math.max(l, h));
      var largeur = Math.max(1, Math.round(l * ratio));
      var hauteur = Math.max(1, Math.round(h * ratio));
      var canvas = document.createElement("canvas");
      canvas.width = largeur;
      canvas.height = hauteur;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, largeur, hauteur);
      ctx.drawImage(source, 0, 0, largeur, hauteur);
      if (source.close) source.close();
      return new Promise(function (resoudre) {
        if (canvas.toBlob) {
          canvas.toBlob(function (blob) {
            resoudre({ blob: blob, largeur: largeur, hauteur: hauteur });
          }, "image/jpeg", QUALITE);
        } else {
          var dataURL = canvas.toDataURL("image/jpeg", QUALITE);
          resoudre({ dataURL: dataURL, largeur: largeur, hauteur: hauteur });
        }
      });
    });
  }

  function blobVersDataURL(blob) {
    return new Promise(function (resoudre, rejeter) {
      var fr = new FileReader();
      fr.onload = function () { resoudre(fr.result); };
      fr.onerror = function () { rejeter(fr.error); };
      fr.readAsDataURL(blob);
    });
  }

  PL.photos = {
    disponible: function () {
      return ouvrir().then(function () { return true; }).catch(function () { return false; });
    },

    supporteSync: function () { return supporte; },

    put: function (fichier) {
      return compresser(fichier).then(function (r) {
        var id = PL.uid();
        var enregistrement = {
          id: id,
          largeur: r.largeur,
          hauteur: r.hauteur,
          creeLe: new Date().toISOString()
        };
        if (r.blob) {
          enregistrement.blob = r.blob;
          enregistrement.octets = r.blob.size;
        } else {
          enregistrement.dataURL = r.dataURL;
          enregistrement.octets = Math.round(r.dataURL.length * 0.75);
        }
        return transaction("readwrite", function (m) { m.put(enregistrement); })
          .then(function () {
            return {
              id: id,
              largeur: r.largeur,
              hauteur: r.hauteur,
              octets: enregistrement.octets
            };
          });
      });
    },

    get: function (id) {
      if (cache[id]) return Promise.resolve(cache[id]);
      return transaction("readonly", function (m) { return m.get(id); })
        .then(function (enr) {
          if (!enr) return null;
          if (enr.dataURL) { cache[id] = enr.dataURL; return enr.dataURL; }
          return blobVersDataURL(enr.blob).then(function (d) { cache[id] = d; return d; });
        })
        .catch(function () { return null; });
    },

    del: function (id) {
      delete cache[id];
      return transaction("readwrite", function (m) { m.delete(id); }).catch(function () {});
    },

    usage: function () {
      return transaction("readonly", function (m) { return m.getAll(); })
        .then(function (tout) {
          return (tout || []).reduce(function (somme, e) { return somme + (e.octets || 0); }, 0);
        })
        .catch(function () { return 0; });
    },

    /* Réinsère une photo sous un identifiant imposé (restauration d'import). */
    restaurer: function (id, dataURL) {
      cache[id] = dataURL;
      return transaction("readwrite", function (m) {
        m.put({
          id: id, dataURL: dataURL,
          octets: Math.round(dataURL.length * 0.75),
          creeLe: new Date().toISOString()
        });
      }).catch(function () {});
    },

    /* Identifiants des photos d'une campagne, ou des deux si `mode` est omis.
       C'est LA liste de référence des emplacements où une photo peut exister :
       tout code qui consomme des photos — l'impression au premier chef — doit
       couvrir les mêmes. Les photos de compteurs ont un jour été oubliées à
       l'impression parce que cette liste y était réécrite en double. */
    idsDuDossier: function (dossier, mode) {
      var campagnes = mode ? [mode] : ["entree", "sortie"];
      var ids = [];
      function collecter(bloc) {
        if (!bloc) return;
        campagnes.forEach(function (c) {
          (bloc[c] || []).forEach(function (p) { if (p && p.id) ids.push(p.id); });
        });
      }
      (dossier.edl.pieces || []).forEach(function (p) { collecter(p.photos); });
      (dossier.mobilier.sections || []).forEach(function (s) {
        (s.lignes || []).forEach(function (l) { collecter(l.photos); });
      });
      campagnes.forEach(function (c) {
        var cpt = dossier.edl.compteurs && dossier.edl.compteurs[c];
        if (!cpt) return;
        PL.DEFAULTS.compteurs.forEach(function (m) {
          ((cpt[m.cle] && cpt[m.cle].photos) || []).forEach(function (p) {
            if (p && p.id) ids.push(p.id);
          });
        });
      });
      return ids;
    },

    /* Supprime toutes les photos référencées par un dossier que l'on efface. */
    purgerDossier: function (dossier) {
      PL.photos.idsDuDossier(dossier).forEach(function (id) { PL.photos.del(id); });
    }
  };
})();
