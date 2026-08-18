/* ------------------------------------------------------------------
   État des lieux : compteurs, chauffage et divers, pièces, équipements.
   ------------------------------------------------------------------ */

/* --- compteurs -------------------------------------------------------- */

PL.vues.compteurs = function (dossier, mode) {
  var lecture = PL.estVerrouille(dossier, mode);
  var section = PL.SECTIONS[1];
  var courants = dossier.edl.compteurs[mode];
  var entree = dossier.edl.compteurs.entree;

  var corps = PL.el("section", { class: "carte" },
    PL.el("div", { class: "carte__entete" },
      PL.el("h2", null, "Relevé des compteurs"),
      PL.el("span", { class: "dossier-ligne__meta" }, "Relevé au jour du constat")
    )
  );

  PL.DEFAULTS.compteurs.forEach(function (m) {
    var cpt = courants[m.cle];
    var bloc = PL.el("div", { class: "constat-ligne" },
      PL.el("div", { class: "constat-grille" },
        PL.champ({
          label: m.libelle, valeur: cpt.valeur, suffixe: m.unite,
          type: "number", lecture: lecture,
          onChange: function (v) { PL.maj(dossier, function () { cpt.valeur = v; }); }
        }),
        mode === "sortie"
          ? PL.el("div", { class: "champ" },
              PL.el("span", { class: "champ__label" }, "Relevé d'entrée"),
              PL.el("div", { style: "min-height:44px;display:flex;align-items:center" },
                (entree[m.cle].valeur || "—") + " " + m.unite))
          : null
      ),
      PL.blocPhotos({
        liste: cpt.photos, lecture: lecture,
        onChange: function () { PL.maj(dossier, function () {}); }
      })
    );
    corps.appendChild(bloc);
  });

  var libres = PL.el("div", null);
  function peindreLibres() {
    PL.vider(libres);
    courants.libres.forEach(function (l, i) {
      libres.appendChild(PL.el("div", { class: "constat-ligne" },
        PL.el("div", { class: "constat-grille" },
          PL.champ({
            label: "Intitulé", valeur: l.libelle, lecture: lecture,
            placeholder: "Autre compteur",
            onChange: function (v) { PL.maj(dossier, function () { l.libelle = v; }); }
          }),
          PL.champ({
            label: "Relevé", valeur: l.valeur, suffixe: l.unite || "", lecture: lecture,
            onChange: function (v) { PL.maj(dossier, function () { l.valeur = v; }); }
          })
        ),
        lecture ? null : PL.el("button", {
          type: "button", class: "btn btn--petit btn--danger",
          onclick: function () {
            PL.maj(dossier, function () { courants.libres.splice(i, 1); });
            peindreLibres();
          }
        }, "Retirer cette ligne")
      ));
    });
    if (!lecture) {
      libres.appendChild(PL.el("button", {
        type: "button", class: "btn btn--petit",
        onclick: function () {
          PL.maj(dossier, function () {
            courants.libres.push({ id: PL.uid(), libelle: "", valeur: "", unite: "" });
          });
          peindreLibres();
        }
      }, "Ajouter un compteur"));
    }
  }
  peindreLibres();
  corps.appendChild(libres);

  return PL.el("div", null,
    PL.enteteDossier(dossier, mode, section),
    corps,
    PL.piedNavigation(dossier, mode, section)
  );
};

/* --- chauffage et divers ---------------------------------------------- */

PL.vues.technique = function (dossier, mode) {
  var lecture = PL.estVerrouille(dossier, mode);
  var section = PL.SECTIONS[2];
  var ch = dossier.edl.chauffage;
  var div = dossier.edl.divers[mode];

  function segChoix(label, valeur, options, onChange) {
    return PL.el("div", { class: "champ" },
      PL.el("span", { class: "champ__label" }, label),
      PL.segmente({
        label: label, valeur: valeur, lecture: lecture,
        options: options.map(function (o) { return { code: o, libelle: o }; }),
        onChange: onChange
      })
    );
  }

  var cles = PL.el("div", null);
  function peindreCles() {
    PL.vider(cles);
    div.cles.forEach(function (k, i) {
      cles.appendChild(PL.el("div", { class: "constat-grille", style: "margin-bottom:6px" },
        PL.champ({
          label: "Nombre de clés", valeur: k.nombre, type: "number", lecture: lecture,
          onChange: function (v) { PL.maj(dossier, function () { k.nombre = v; }); }
        }),
        PL.el("div", { style: "display:flex;gap:8px;align-items:flex-end" },
          PL.champ({
            label: "Pour", valeur: k.usage, lecture: lecture,
            placeholder: "porte palière, boîte aux lettres, cave…",
            onChange: function (v) { PL.maj(dossier, function () { k.usage = v; }); }
          }),
          lecture || div.cles.length < 2 ? null : PL.el("button", {
            type: "button", class: "btn btn--petit btn--danger",
            "aria-label": "Retirer ce jeu de clés",
            style: "margin-bottom:12px",
            onclick: function () {
              PL.maj(dossier, function () { div.cles.splice(i, 1); });
              peindreCles();
            }
          }, "×")
        )
      ));
    });
    if (!lecture) {
      cles.appendChild(PL.el("button", {
        type: "button", class: "btn btn--petit",
        onclick: function () {
          PL.maj(dossier, function () {
            div.cles.push({ id: PL.uid(), nombre: "", usage: "" });
          });
          peindreCles();
        }
      }, "Ajouter un jeu de clés"));
    }
  }
  peindreCles();

  return PL.el("div", null,
    PL.enteteDossier(dossier, mode, section),

    PL.el("section", { class: "carte" },
      PL.el("div", { class: "carte__entete" }, PL.el("h2", null, "Chauffage")),
      PL.el("div", { class: "grille-champs" },
        segChoix("Mode", ch.mode, PL.DEFAULTS.chauffageModes, function (v) {
          PL.maj(dossier, function () { ch.mode = v; });
        }),
        segChoix("Énergie", ch.energie, PL.DEFAULTS.chauffageEnergies, function (v) {
          PL.maj(dossier, function () { ch.energie = v; });
        }),
        PL.champ({
          label: "Nombre de radiateurs", valeur: ch.nbRadiateurs, type: "number",
          lecture: lecture,
          onChange: function (v) { PL.maj(dossier, function () { ch.nbRadiateurs = v; }); }
        }),
        PL.champ({
          label: "Production d'eau chaude", valeur: ch.eauChaude, lecture: lecture,
          placeholder: "chaudière, ballon, cumulus…",
          onChange: function (v) { PL.maj(dossier, function () { ch.eauChaude = v; }); }
        }),
        PL.champ({
          label: "Observations", valeur: ch.note, multiligne: true, large: true,
          lecture: lecture,
          onChange: function (v) { PL.maj(dossier, function () { ch.note = v; }); }
        })
      )
    ),

    PL.el("section", { class: "carte" },
      PL.el("div", { class: "carte__entete" },
        PL.el("h2", null, "Clés remises" + (mode === "sortie" ? " / restituées" : ""))),
      cles
    ),

    PL.el("section", { class: "carte" },
      PL.el("div", { class: "carte__entete" }, PL.el("h2", null, "Sécurité et divers")),
      PL.el("div", { class: "grille-champs" },
        PL.champ({
          label: "Nombre de détecteurs de fumée", valeur: div.detecteurs.nombre,
          type: "number", lecture: lecture,
          onChange: function (v) { PL.maj(dossier, function () { div.detecteurs.nombre = v; }); }
        }),
        PL.el("div", { class: "champ" },
          PL.el("span", { class: "champ__label" }, "Test des détecteurs"),
          PL.caseACocher({
            label: "Test réalisé en présence du locataire",
            coche: div.detecteurs.testRealise, lecture: lecture,
            onChange: function (v) {
              PL.maj(dossier, function () { div.detecteurs.testRealise = v; });
            }
          })
        ),
        PL.champ({
          label: "Réception télévision", valeur: div.receptionTV, lecture: lecture,
          placeholder: "antenne collective, TNT, satellite…",
          onChange: function (v) { PL.maj(dossier, function () { div.receptionTV = v; }); }
        })
      ),
      PL.el("div", { class: "grille-cases", style: "margin:10px 0" },
        [
          { cle: "boiteAuxLettres", libelle: "Boîte aux lettres" },
          { cle: "sonnette", libelle: "Sonnette" },
          { cle: "interphone", libelle: "Interphone" }
        ].map(function (o) {
          return PL.caseACocher({
            label: o.libelle, coche: div[o.cle], lecture: lecture,
            onChange: function (v) { PL.maj(dossier, function () { div[o.cle] = v; }); }
          });
        })
      ),
      PL.champ({
        label: "Autres observations", valeur: div.note, multiligne: true, lecture: lecture,
        onChange: function (v) { PL.maj(dossier, function () { div.note = v; }); }
      })
    ),

    PL.piedNavigation(dossier, mode, section)
  );
};

/* --- pièces ------------------------------------------------------------ */

PL.vues.pieces = function (dossier, mode) {
  var lecture = PL.estVerrouille(dossier, mode);
  var section = PL.SECTIONS[3];
  var champEtat = mode === "sortie" ? "etatSortie" : "etatEntree";
  var champRemarque = mode === "sortie" ? "remarqueSortie" : "remarqueEntree";
  var courante = dossier.edl.pieces.length ? dossier.edl.pieces[0].id : null;

  var nav = PL.el("div", { class: "liste-nav" });
  var panneau = PL.el("div", null);
  var idListe = "revetements-" + PL.uid().slice(0, 6);

  function pieceCourante() {
    return dossier.edl.pieces.filter(function (p) { return p.id === courante; })[0] || null;
  }

  function compteurPiece(p) {
    var faits = PL.SUPPORTS.filter(function (s) { return p.supports[s.cle][champEtat]; }).length;
    return faits + "/" + PL.SUPPORTS.length;
  }

  function peindreNav() {
    PL.vider(nav);
    dossier.edl.pieces.forEach(function (p) {
      var complet = compteurPiece(p) === PL.SUPPORTS.length + "/" + PL.SUPPORTS.length;
      nav.appendChild(PL.el("button", {
        type: "button", class: "liste-nav__item",
        "aria-current": p.id === courante ? "true" : "false",
        onclick: function () { courante = p.id; peindreNav(); peindrePanneau(); }
      },
        PL.el("span", null, p.nom),
        PL.el("span", { class: "hub-item__compte" + (complet ? " hub-item__compte--complet" : "") },
          compteurPiece(p))
      ));
    });
  }

  /* Hors du conteneur défilant : en barre horizontale il deviendrait
     une colonne de plus au lieu d'une action pleine largeur. */
  var zoneAjout = lecture ? null : PL.el("div", { style: "margin-top:8px" },
    PL.el("button", {
      type: "button", class: "btn btn--petit btn--bloc",
      onclick: function () {
        PL.demanderTexte({
          titre: "Ajouter une pièce", label: "Nom de la pièce", valider: "Ajouter"
        }).then(function (nom) {
          if (!nom) return;
          var p = PL.nouvellePiece(nom, true);
          PL.maj(dossier, function (d) { d.edl.pieces.push(p); });
          courante = p.id;
          peindreNav(); peindrePanneau();
        });
      }
    }, "Ajouter une pièce"));

  function peindrePanneau() {
    PL.vider(panneau);
    var p = pieceCourante();
    if (!p) {
      panneau.appendChild(PL.el("div", { class: "etat-vide" }, "Aucune pièce dans ce dossier."));
      return;
    }

    var carte = PL.el("section", { class: "carte" },
      PL.el("div", { class: "carte__entete" },
        PL.el("div", { class: "carte__titre" }, PL.el("h2", null, p.nom)),
        lecture ? null : PL.el("div", { class: "app-entete__actions" },
          PL.el("button", {
            type: "button", class: "btn btn--petit",
            onclick: function () {
              PL.SUPPORTS.forEach(function (s) {
                PL.maj(dossier, function () { p.supports[s.cle][champEtat] = "B"; });
              });
              peindreNav(); peindrePanneau();
              PL.annoncer("Pièce " + p.nom + " renseignée en bon état.");
            }
          }, "Tout en bon état"),
          PL.el("button", {
            type: "button", class: "btn btn--petit",
            onclick: function () {
              PL.demanderTexte({
                titre: "Renommer la pièce", label: "Nom", valeur: p.nom, valider: "Renommer"
              }).then(function (nom) {
                if (!nom) return;
                PL.maj(dossier, function () { p.nom = nom; });
                peindreNav(); peindrePanneau();
              });
            }
          }, "Renommer"),
          PL.el("button", {
            type: "button", class: "btn btn--petit",
            onclick: function () {
              var copie = JSON.parse(JSON.stringify(p));
              copie.id = PL.uid();
              copie.nom = p.nom + " (copie)";
              copie.photos = { entree: [], sortie: [] };
              PL.maj(dossier, function (d) { d.edl.pieces.push(copie); });
              courante = copie.id;
              peindreNav(); peindrePanneau();
            }
          }, "Dupliquer"),
          p.supprimable ? PL.el("button", {
            type: "button", class: "btn btn--petit btn--danger",
            onclick: function () {
              PL.confirmer({
                titre: "Supprimer « " + p.nom + " » ?",
                message: "Le constat de cette pièce et ses photos seront perdus.",
                valider: "Supprimer", danger: true
              }).then(function (ok) {
                if (!ok) return;
                PL.maj(dossier, function (d) {
                  d.edl.pieces = d.edl.pieces.filter(function (x) { return x.id !== p.id; });
                });
                courante = dossier.edl.pieces.length ? dossier.edl.pieces[0].id : null;
                peindreNav(); peindrePanneau();
              });
            }
          }, "Supprimer") : null
        )
      )
    );

    PL.SUPPORTS.forEach(function (s) {
      var sup = p.supports[s.cle];
      carte.appendChild(PL.el("div", { class: "constat-ligne" },
        PL.el("div", { class: "constat-ligne__entete" },
          PL.el("span", { class: "constat-ligne__nom" }, s.libelle),
          mode === "sortie" ? PL.etatLecture(sup.etatEntree) : null
        ),
        PL.el("div", { class: "constat-grille" },
          PL.champ({
            label: "Revêtement", valeur: sup.revetement, lecture: lecture, liste: idListe,
            placeholder: "peinture, carrelage, parquet…",
            onChange: function (v) { PL.maj(dossier, function () { sup.revetement = v; }); }
          }),
          PL.el("div", { class: "champ" },
            PL.el("span", { class: "champ__label" }, "État constaté"),
            PL.segmente({
              label: s.libelle + " — état", valeur: sup[champEtat], options: PL.ETATS_BATI,
              lecture: lecture,
              onChange: function (v) {
                PL.maj(dossier, function () { sup[champEtat] = v; });
                peindreNav();
              }
            })
          ),
          PL.champ({
            label: "Remarques", valeur: sup[champRemarque], multiligne: true, rows: 2,
            large: true, lecture: lecture,
            onChange: function (v) { PL.maj(dossier, function () { sup[champRemarque] = v; }); }
          })
        ),
        mode === "sortie" && sup.remarqueEntree
          ? PL.el("div", { class: "note" }, "Remarque d'entrée : " + sup.remarqueEntree)
          : null
      ));
    });

    if (mode === "sortie" && p.photos.entree.length) {
      var avant = PL.el("div", { style: "margin-top:10px" },
        PL.el("span", { class: "champ__label" }, "Photos d'entrée"));
      var grille = PL.el("div", { class: "photos__grille" });
      p.photos.entree.forEach(function (ref) {
        var v = PL.el("div", { class: "photo-vignette" });
        PL.photos.get(ref.id).then(function (data) {
          if (data) v.appendChild(PL.el("img", { src: data, alt: "Photo d'entrée" }));
        });
        grille.appendChild(v);
      });
      avant.appendChild(grille);
      carte.appendChild(avant);
    }

    carte.appendChild(PL.el("div", { style: "margin-top:12px" },
      PL.el("span", { class: "champ__label" },
        "Photos — " + PL.libelleMode(mode).toLowerCase()),
      PL.blocPhotos({
        liste: p.photos[mode], lecture: lecture,
        onChange: function () { PL.maj(dossier, function () {}); }
      })
    ));

    panneau.appendChild(carte);
  }

  peindreNav();
  peindrePanneau();

  return PL.el("div", null,
    PL.enteteDossier(dossier, mode, section),
    PL.datalist(idListe, PL.REVETEMENTS),
    PL.el("div", { class: "duo" },
      PL.el("aside", { class: "duo__aside" },
        PL.el("div", { class: "carte" },
          PL.el("h2", { style: "margin-bottom:8px;font-size:0.95rem" }, "Pièces"),
          nav, zoneAjout)
      ),
      panneau
    ),
    PL.piedNavigation(dossier, mode, section)
  );
};

/* --- équipements -------------------------------------------------------- */

PL.vues.equipements = function (dossier, mode) {
  var lecture = PL.estVerrouille(dossier, mode);
  var section = PL.SECTIONS[4];
  var champ = mode === "sortie" ? "presentSortie" : "presentEntree";

  var blocs = [
    { cle: "cuisine", titre: "Équipements cuisine" },
    { cle: "salleDEau", titre: "Équipements salle d'eau" },
    { cle: "wc", titre: "Équipements WC" }
  ];

  var racine = PL.el("div", null,
    PL.enteteDossier(dossier, mode, section),
    PL.el("div", { class: "note" },
      "Cochez les équipements présents et en place au moment du constat. " +
      "Utilisez le champ « précision » pour un modèle, une marque ou une réserve.")
  );

  blocs.forEach(function (b) {
    var carte = PL.el("section", { class: "carte" },
      PL.el("div", { class: "carte__entete" }, PL.el("h2", null, b.titre)));
    var liste = PL.el("div", null);

    function peindre() {
      PL.vider(liste);
      dossier.edl.equipements[b.cle].forEach(function (eq, i) {
        liste.appendChild(PL.el("div", { class: "constat-grille", style: "margin-bottom:6px" },
          PL.caseACocher({
            label: eq.libelle, coche: eq[champ], lecture: lecture,
            onChange: function (v) { PL.maj(dossier, function () { eq[champ] = v; }); }
          }),
          PL.el("div", { style: "display:flex;gap:6px;align-items:flex-end" },
            PL.champ({
              label: "Précision", valeur: eq.precision, lecture: lecture,
              onChange: function (v) { PL.maj(dossier, function () { eq.precision = v; }); }
            }),
            lecture ? null : PL.el("button", {
              type: "button", class: "btn btn--petit btn--danger",
              "aria-label": "Retirer " + eq.libelle, style: "margin-bottom:12px",
              onclick: function () {
                PL.maj(dossier, function () {
                  dossier.edl.equipements[b.cle].splice(i, 1);
                });
                peindre();
              }
            }, "×")
          )
        ));
      });
      if (!lecture) {
        liste.appendChild(PL.el("button", {
          type: "button", class: "btn btn--petit",
          onclick: function () {
            PL.demanderTexte({
              titre: "Ajouter un équipement", label: "Désignation", valider: "Ajouter"
            }).then(function (nom) {
              if (!nom) return;
              PL.maj(dossier, function () {
                dossier.edl.equipements[b.cle].push({
                  id: PL.uid(), libelle: nom, presentEntree: mode === "entree",
                  presentSortie: false, precision: ""
                });
              });
              peindre();
            });
          }
        }, "Ajouter un équipement"));
      }
    }

    peindre();
    carte.appendChild(liste);
    racine.appendChild(carte);
  });

  racine.appendChild(PL.piedNavigation(dossier, mode, section));
  return racine;
};
