/* ------------------------------------------------------------------
   Rendu d'impression. Le DOM A4 est reconstruit à partir du store :
   il ne réutilise jamais le DOM de saisie. C'est ce qui permet de
   maîtriser la pagination sans contraindre l'ergonomie tactile.
   ------------------------------------------------------------------ */

(function () {
  var attentesImages = [];

  function el(tag, props) {
    return PL.el.apply(null, arguments);
  }

  function texteOu(v, defaut) {
    var s = v === null || v === undefined ? "" : String(v).trim();
    return s || (defaut === undefined ? "" : defaut);
  }

  /* Image chargée depuis IndexedDB : on mémorise la promesse pour
     n'imprimer qu'une fois toutes les images décodées. */
  function image(refId, alt, classe) {
    var img = el("img", { class: classe || "p-photo", alt: alt || "" });
    attentesImages.push(
      PL.photos.get(refId).then(function (data) {
        if (!data) return null;
        img.src = data;
        return img.decode ? img.decode().catch(function () {}) : null;
      }).catch(function () { return null; })
    );
    return img;
  }

  function grillePhotos(refs, legende) {
    if (!refs || !refs.length) return null;
    return el("div", { class: "p-photos p-eviter-coupure" },
      el("div", { class: "p-photos__titre" }, legende),
      el("div", { class: "p-photos__grille" },
        refs.map(function (r) { return image(r.id, legende); }))
    );
  }

  /* Le titre passe dans le <thead> : ainsi il est réémis en haut de chaque
     page quand le tableau se scinde. Un simple <h2> au-dessus laisserait la
     page suivante commencer par des lignes orphelines de leur section. */
  function tableau(entetes, lignes, titre) {
    var thead = el("thead", null);
    if (titre) {
      thead.appendChild(el("tr", null,
        el("th", { colspan: entetes.length, class: "p-table__titre", scope: "colgroup" }, titre)));
    }
    thead.appendChild(el("tr", null, entetes.map(function (h) {
      return el("th", h.style ? { style: h.style, scope: "col" } : { scope: "col" },
        h.libelle || h);
    })));
    return el("table", { class: "p-table" }, thead, el("tbody", null, lignes));
  }

  function blocIdentite(dossier, mode) {
    var camp = dossier.campagnes[mode];
    var l = dossier.logement;
    var complement = [
      l.batiment && "Bât. " + l.batiment,
      l.escalier && "Esc. " + l.escalier,
      l.etage && "Étage " + l.etage,
      l.porte && "Porte " + l.porte
    ].filter(Boolean).join(" · ");

    return el("section", { class: "p-identite p-eviter-coupure" },
      el("div", { class: "p-identite__col" },
        el("h3", null, "Logement"),
        el("p", null, texteOu(l.adresse, "—")),
        complement ? el("p", null, complement) : null
      ),
      el("div", { class: "p-identite__col" },
        el("h3", null, "Bailleur"),
        el("p", null, texteOu(dossier.bailleur.nom, "—")),
        el("p", null, texteOu(dossier.bailleur.adresse, ""))
      ),
      el("div", { class: "p-identite__col" },
        el("h3", null, "Locataire"),
        el("p", null, texteOu(dossier.locataire.nom, "—")),
        el("p", null, texteOu(
          mode === "sortie" ? dossier.locataire.adresseSortie : dossier.locataire.adresseEntree, "")),
        el("p", null, "Date du constat : " + texteOu(PL.dateFr(camp.date), "—"))
      )
    );
  }

  function blocSignatures(dossier, mode) {
    var camp = dossier.campagnes[mode];
    function case_(titre, nom, signature) {
      return el("div", { class: "p-signature" },
        el("div", { class: "p-signature__titre" }, titre),
        el("div", { class: "p-signature__mention" }, "« Lu et approuvé »"),
        el("div", { class: "p-signature__zone" },
          signature ? el("img", { src: signature, alt: "Signature" }) : null),
        el("div", { class: "p-signature__nom" }, texteOu(nom, ""))
      );
    }
    return el("section", { class: "p-eviter-coupure", style: "margin-top:6mm" },
      el("p", { class: "p-mention" },
        "Fait à " + texteOu(camp.lieu, "……………………") +
        ", le " + texteOu(PL.dateFr(camp.date), "……/……/…………") +
        ", en " + texteOu(camp.nbExemplaires, "……") + " exemplaires originaux."),
      el("div", { class: "p-signatures" },
        case_("Le bailleur", camp.nomBailleur, camp.signatureBailleur),
        case_("Le locataire", camp.nomLocataire, camp.signatureLocataire))
    );
  }

  function enteteDocument(dossier, mode, titre, sousTitre) {
    var incomplet = !dossier.campagnes[mode].signeLe;
    return el("header", { class: "p-entete" },
      el("h1", null, titre),
      el("p", { class: "p-entete__sous" }, sousTitre),
      incomplet ? el("p", { class: "p-entete__mention" },
        "Document non signé — projet de constat") : null
    );
  }

  /* --- état des lieux ------------------------------------------------- */

  function celluleSupport(sup, mode) {
    var contenu = [];
    if (sup.revetement) contenu.push(el("div", { class: "p-revetement" }, sup.revetement));
    if (mode === "sortie") {
      contenu.push(el("div", { class: "p-etat" },
        "E : " + texteOu(sup.etatEntree, "—") + "  →  S : " + texteOu(sup.etatSortie, "—")));
    } else {
      contenu.push(el("div", { class: "p-etat" }, texteOu(sup.etatEntree, "—")));
    }
    return el("td", null, contenu);
  }

  PL.print = PL.print || {};

  PL.print.edl = function (dossier, mode) {
    var frag = document.createDocumentFragment();
    var camp = dossier.campagnes[mode];

    frag.appendChild(enteteDocument(dossier, mode,
      "État des lieux",
      "Constat " + PL.deMode(mode) +
      (camp.date ? " — " + PL.dateFr(camp.date) : "")));
    frag.appendChild(blocIdentite(dossier, mode));

    /* compteurs */
    var cpt = dossier.edl.compteurs[mode];
    var lignesCpt = PL.DEFAULTS.compteurs.map(function (m) {
      return el("tr", { class: "p-eviter-coupure" },
        el("td", null, m.libelle),
        el("td", { class: "p-num" }, texteOu(cpt[m.cle].valeur, "…………")),
        el("td", null, m.unite));
    });
    (cpt.libres || []).forEach(function (l) {
      if (!l.libelle && !l.valeur) return;
      lignesCpt.push(el("tr", { class: "p-eviter-coupure" },
        el("td", null, texteOu(l.libelle, "—")),
        el("td", { class: "p-num" }, texteOu(l.valeur, "…………")),
        el("td", null, texteOu(l.unite, ""))));
    });

    /* Les clichés de compteur restent avec leur relevé : c'est le chiffre
       qu'ils justifient, et c'est celui qui est le plus souvent contesté. */
    var photosCompteurs = [];
    PL.DEFAULTS.compteurs.forEach(function (m) {
      var refs = (cpt[m.cle] && cpt[m.cle].photos) || [];
      if (refs.length) photosCompteurs.push(grillePhotos(refs, m.libelle));
    });

    frag.appendChild(el("section", { class: "p-section" },
      el("h2", null, "Relevé des compteurs"),
      tableau([
        { libelle: "Compteur", style: "width:55%" },
        { libelle: "Relevé", style: "width:30%" },
        { libelle: "Unité", style: "width:15%" }
      ], lignesCpt),
      photosCompteurs.length
        ? el("div", { style: "margin-top:3mm" }, photosCompteurs)
        : null
    ));

    /* chauffage et divers */
    var ch = dossier.edl.chauffage;
    var div = dossier.edl.divers[mode];
    var cles = (div.cles || []).filter(function (k) { return k.nombre || k.usage; })
      .map(function (k) {
        return texteOu(k.nombre, "…") + " clé(s) pour " + texteOu(k.usage, "……………………");
      });
    var presents = [
      div.boiteAuxLettres && "Boîte aux lettres",
      div.sonnette && "Sonnette",
      div.interphone && "Interphone"
    ].filter(Boolean);

    frag.appendChild(el("section", { class: "p-section p-eviter-coupure" },
      el("h2", null, "Chauffage, clés et sécurité"),
      el("div", { class: "p-deux-col" },
        el("div", null,
          el("p", null, el("strong", null, "Chauffage : "),
            texteOu(ch.mode, "—") + (ch.energie ? " · " + ch.energie : "") +
            (ch.nbRadiateurs ? " · " + ch.nbRadiateurs + " radiateur(s)" : "")),
          ch.eauChaude ? el("p", null, el("strong", null, "Eau chaude : "), ch.eauChaude) : null,
          ch.note ? el("p", null, ch.note) : null
        ),
        el("div", null,
          cles.length ? el("p", null, el("strong", null, "Clés : "), cles.join(" ; ")) : null,
          el("p", null, el("strong", null, "Détecteurs de fumée : "),
            texteOu(div.detecteurs.nombre, "…") +
            (div.detecteurs.testRealise ? " — test réalisé" : " — test non réalisé")),
          div.receptionTV ? el("p", null, el("strong", null, "Réception TV : "), div.receptionTV) : null,
          presents.length ? el("p", null, el("strong", null, "Présents : "), presents.join(" · ")) : null,
          div.note ? el("p", null, div.note) : null
        )
      )
    ));

    /* pièces */
    var lignesPieces = [];
    dossier.edl.pieces.forEach(function (p) {
      var remarques = PL.SUPPORTS.map(function (s) {
        var sup = p.supports[s.cle];
        var r = mode === "sortie" ? sup.remarqueSortie : sup.remarqueEntree;
        return r ? s.libelle + " : " + r : null;
      }).filter(Boolean).join(" · ");
      lignesPieces.push(el("tr", { class: "p-eviter-coupure" },
        el("th", { scope: "row" }, p.nom),
        celluleSupport(p.supports.plafond, mode),
        celluleSupport(p.supports.murs, mode),
        celluleSupport(p.supports.sol, mode),
        el("td", null, remarques)
      ));
    });

    frag.appendChild(el("section", { class: "p-section" },
      el("p", { class: "p-legende" },
        "Revêtement indiqué au-dessus de l'état. États : N = neuf, B = bon, M = mauvais." +
        (mode === "sortie" ? " E = entrée, S = sortie." : "")),
      tableau([
        { libelle: "Pièce", style: "width:16%" },
        { libelle: "Plafond", style: "width:17%" },
        { libelle: "Murs", style: "width:17%" },
        { libelle: "Sol", style: "width:17%" },
        { libelle: "Remarques", style: "width:33%" }
      ], lignesPieces, "État des pièces")
    ));

    /* équipements */
    var blocsEquip = [
      { cle: "cuisine", titre: "Cuisine" },
      { cle: "salleDEau", titre: "Salle d'eau" },
      { cle: "wc", titre: "WC" }
    ];
    var champPresent = mode === "sortie" ? "presentSortie" : "presentEntree";
    var contenuEquip = blocsEquip.map(function (b) {
      var items = dossier.edl.equipements[b.cle].map(function (eq) {
        return el("li", { class: eq[champPresent] ? "p-coche" : "p-non-coche" },
          eq.libelle + (eq.precision ? " — " + eq.precision : ""));
      });
      return el("div", null, el("h3", null, b.titre), el("ul", { class: "p-liste-cases" }, items));
    });

    frag.appendChild(el("section", { class: "p-section p-eviter-coupure" },
      el("h2", null, "Équipements"),
      el("p", { class: "p-legende" }, "☑ présent et en place · ☐ absent ou non constaté"),
      el("div", { class: "p-trois-col" }, contenuEquip)
    ));

    /* photos des pièces */
    var photos = [];
    dossier.edl.pieces.forEach(function (p) {
      var refs = p.photos[mode] || [];
      if (refs.length) photos.push(grillePhotos(refs, p.nom));
    });
    if (photos.length) {
      frag.appendChild(el("section", { class: "p-section" },
        el("h2", null, "Photographies"), photos));
    }

    /* observations */
    frag.appendChild(el("section", { class: "p-section p-eviter-coupure" },
      el("h2", null, "Observations et réserves"),
      el("div", { class: "p-zone-texte" }, texteOu(dossier.observations[mode], ""))
    ));

    frag.appendChild(blocSignatures(dossier, mode));
    return frag;
  };

  /* --- inventaire mobilier --------------------------------------------- */

  PL.print.mobilier = function (dossier, mode) {
    var frag = document.createDocumentFragment();
    var camp = dossier.campagnes[mode];

    frag.appendChild(enteteDocument(dossier, mode,
      "Inventaire et état des meubles",
      "Annexe obligatoire au bail meublé — article 25-8 de la loi n° 89-462" +
      (camp.date ? " · " + PL.dateFr(camp.date) : "")));
    frag.appendChild(blocIdentite(dossier, mode));

    frag.appendChild(el("p", { class: "p-legende" },
      "États : TB = très bon, B = bon, P = passable, M = mauvais. " +
      "« Ø » en quantité signale un élément absent."));

    dossier.mobilier.sections.forEach(function (sec) {
      var lignes = sec.lignes.map(function (l) {
        return el("tr", { class: "p-eviter-coupure" },
          el("th", { scope: "row" }, l.libelle),
          el("td", { class: "p-num" }, l.absent ? "Ø" : texteOu(l.qte, "")),
          el("td", { class: "p-num" }, l.absent ? "—" : texteOu(l.etatEntree, "")),
          el("td", { class: "p-num" }, l.absent ? "—" : texteOu(l.etatSortie, "")),
          el("td", null, texteOu(l.observations, ""))
        );
      });
      frag.appendChild(el("section", { class: "p-section" },
        tableau([
          { libelle: "Désignation", style: "width:38%" },
          { libelle: "Qté", style: "width:9%" },
          { libelle: "État entrée", style: "width:12%" },
          { libelle: "État sortie", style: "width:12%" },
          { libelle: "Observations", style: "width:29%" }
        ], lignes, sec.titre)
      ));
    });

    var photos = [];
    dossier.mobilier.sections.forEach(function (sec) {
      sec.lignes.forEach(function (l) {
        var refs = l.photos[mode] || [];
        if (refs.length) photos.push(grillePhotos(refs, sec.titre + " — " + l.libelle));
      });
    });
    if (photos.length) {
      frag.appendChild(el("section", { class: "p-section" },
        el("h2", null, "Photographies"), photos));
    }

    frag.appendChild(el("section", { class: "p-section p-eviter-coupure" },
      el("h2", null, "Observations et réserves"),
      el("div", { class: "p-zone-texte" }, texteOu(dossier.observations[mode], ""))
    ));

    frag.appendChild(blocSignatures(dossier, mode));
    return frag;
  };

  /* --- écarts entrée / sortie ------------------------------------------ */

  PL.print.calculerEcarts = function (dossier) {
    var ecarts = [];

    dossier.edl.pieces.forEach(function (p) {
      PL.SUPPORTS.forEach(function (s) {
        var sup = p.supports[s.cle];
        if (!sup.etatEntree || !sup.etatSortie) return;
        if (PL.RANG_BATI[sup.etatSortie] > PL.RANG_BATI[sup.etatEntree]) {
          ecarts.push({
            zone: p.nom,
            libelle: s.libelle + (sup.revetement ? " (" + sup.revetement + ")" : ""),
            entree: sup.etatEntree,
            sortie: sup.etatSortie,
            observations: [sup.remarqueEntree, sup.remarqueSortie].filter(Boolean).join(" → "),
            photosEntree: p.photos.entree,
            photosSortie: p.photos.sortie
          });
        }
      });
    });

    dossier.mobilier.sections.forEach(function (sec) {
      sec.lignes.forEach(function (l) {
        if (l.absent || !l.etatEntree || !l.etatSortie) return;
        if (PL.RANG_MOBILIER[l.etatSortie] > PL.RANG_MOBILIER[l.etatEntree]) {
          ecarts.push({
            zone: sec.titre,
            libelle: l.libelle,
            entree: l.etatEntree,
            sortie: l.etatSortie,
            observations: l.observations,
            photosEntree: l.photos.entree,
            photosSortie: l.photos.sortie
          });
        }
      });
    });

    return ecarts;
  };

  PL.print.ecarts = function (dossier) {
    var liste = PL.print.calculerEcarts(dossier);
    var frag = document.createDocumentFragment();

    frag.appendChild(enteteDocument(dossier, "sortie",
      "Récapitulatif des écarts entrée / sortie",
      "Annexe au constat de sortie — postes dont l'état s'est dégradé"));
    frag.appendChild(blocIdentite(dossier, "sortie"));

    if (!liste.length) {
      frag.appendChild(el("p", { class: "p-zone-texte" },
        "Aucune dégradation constatée entre l'état des lieux d'entrée et celui de sortie."));
      frag.appendChild(blocSignatures(dossier, "sortie"));
      return frag;
    }

    frag.appendChild(el("p", { class: "p-legende" },
      "Ce récapitulatif est établi automatiquement par comparaison des états relevés " +
      "à l'entrée et à la sortie. Il ne vaut ni chiffrage, ni application d'une grille de vétusté."));

    liste.forEach(function (e) {
      var bloc = el("section", { class: "p-ecart p-eviter-coupure" },
        el("h3", null, e.zone + " — " + e.libelle),
        el("p", { class: "p-etat" },
          "État d'entrée : " + e.entree + "   →   État de sortie : " + e.sortie),
        e.observations ? el("p", null, e.observations) : null
      );
      var avant = (e.photosEntree || [])[0];
      var apres = (e.photosSortie || [])[0];
      if (avant || apres) {
        bloc.appendChild(el("div", { class: "p-avant-apres" },
          el("figure", null,
            avant ? image(avant.id, "Photo d'entrée") : el("div", { class: "p-photo-absente" }, "—"),
            el("figcaption", null, "Entrée")),
          el("figure", null,
            apres ? image(apres.id, "Photo de sortie") : el("div", { class: "p-photo-absente" }, "—"),
            el("figcaption", null, "Sortie"))
        ));
      }
      frag.appendChild(bloc);
    });

    frag.appendChild(blocSignatures(dossier, "sortie"));
    return frag;
  };

  /* --- lancement -------------------------------------------------------- */

  PL.print.construire = function (type, dossier, mode) {
    var conteneur = document.getElementById("conteneur-impression");
    PL.vider(conteneur);
    attentesImages = [];

    var docs = [];
    if (type === "edl") docs.push(PL.print.edl(dossier, mode));
    else if (type === "mobilier") docs.push(PL.print.mobilier(dossier, mode));
    else if (type === "ecarts") docs.push(PL.print.ecarts(dossier));
    else {
      docs.push(PL.print.edl(dossier, mode));
      docs.push(PL.print.mobilier(dossier, mode));
      if (mode === "sortie") docs.push(PL.print.ecarts(dossier));
    }

    docs.forEach(function (d, i) {
      var page = el("article", { class: "p-doc" + (i ? " p-doc--nouvelle-page" : "") });
      page.appendChild(d);
      conteneur.appendChild(page);
    });

    /* Pied unique, en position fixe : le moteur d'impression le réémet
       sur chaque page. Un pied par document se répéterait aussi sur les
       pages des documents suivants. */
    conteneur.appendChild(el("div", { class: "p-pied-global" },
      el("span", null, "Potentia Loan · " +
        texteOu(dossier.logement.adresse, "dossier sans adresse").split("\n")[0]),
      el("span", null, "Édité par Potentia Digital")
    ));

    conteneur.setAttribute("aria-hidden", "true");

    /* Filet : toute photo saisie dans la campagne imprimée doit se retrouver
       dans le document. Un emplacement ajouté à la saisie mais oublié ici se
       signale immédiatement au lieu de disparaître en silence. */
    if (type === "complet") {
      var attendues = PL.photos.idsDuDossier(dossier, mode).length;
      var produites = conteneur.querySelectorAll(".p-photos img").length;
      if (produites < attendues && window.console && window.console.warn) {
        window.console.warn(
          "Potentia Loan — " + (attendues - produites) + " photo(s) de la campagne « " +
          mode + " » ne sont pas reprises dans le document imprimé.");
      }
    }

    return Promise.all(attentesImages);
  };

  PL.print.lancer = function (type, dossier, mode) {
    PL.toast("Préparation du document…");
    return PL.print.construire(type, dossier, mode).then(function () {
      return new Promise(function (r) { setTimeout(r, 120); });
    }).then(function () {
      window.print();
    }).catch(function (e) {
      PL.toast("Impression impossible : " + (e && e.message ? e.message : "erreur"));
    });
  };
})();
