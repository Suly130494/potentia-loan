/* ------------------------------------------------------------------
   Inventaire et état des meubles — annexe obligatoire du bail meublé
   (art. 25-8 de la loi n° 89-462).
   ------------------------------------------------------------------ */

PL.vues.mobilier = function (dossier, mode) {
  var lecture = PL.estVerrouille(dossier, mode);
  var section = PL.SECTIONS[5];
  var champEtat = mode === "sortie" ? "etatSortie" : "etatEntree";
  var courante = dossier.mobilier.sections.length ? dossier.mobilier.sections[0].id : null;

  var nav = PL.el("div", { class: "liste-nav" });
  var panneau = PL.el("div", null);

  function sectionCourante() {
    return dossier.mobilier.sections.filter(function (s) { return s.id === courante; })[0] || null;
  }

  function compteur(sec) {
    var faits = sec.lignes.filter(function (l) { return l.absent || l[champEtat]; }).length;
    return faits + "/" + sec.lignes.length;
  }

  function peindreNav() {
    PL.vider(nav);
    dossier.mobilier.sections.forEach(function (sec) {
      var complet = sec.lignes.length > 0 &&
        sec.lignes.every(function (l) { return l.absent || l[champEtat]; });
      nav.appendChild(PL.el("button", {
        type: "button", class: "liste-nav__item",
        "aria-current": sec.id === courante ? "true" : "false",
        onclick: function () { courante = sec.id; peindreNav(); peindrePanneau(); }
      },
        PL.el("span", null, sec.titre),
        PL.el("span", { class: "hub-item__compte" + (complet ? " hub-item__compte--complet" : "") },
          compteur(sec))
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
          titre: "Ajouter une section", label: "Intitulé de la section", valider: "Ajouter"
        }).then(function (titre) {
          if (!titre) return;
          var sec = PL.nouvelleSection(titre, []);
          PL.maj(dossier, function (d) { d.mobilier.sections.push(sec); });
          courante = sec.id;
          peindreNav(); peindrePanneau();
        });
      }
    }, "Ajouter une section"));

  function peindrePanneau() {
    PL.vider(panneau);
    var sec = sectionCourante();
    if (!sec) {
      panneau.appendChild(PL.el("div", { class: "etat-vide" }, "Aucune section d'inventaire."));
      return;
    }

    var carte = PL.el("section", { class: "carte" },
      PL.el("div", { class: "carte__entete" },
        PL.el("div", { class: "carte__titre" }, PL.el("h2", null, sec.titre)),
        lecture ? null : PL.el("div", { class: "app-entete__actions" },
          PL.el("button", {
            type: "button", class: "btn btn--petit",
            onclick: function () {
              PL.maj(dossier, function () {
                sec.lignes.forEach(function (l) { if (!l.absent) l[champEtat] = "B"; });
              });
              peindreNav(); peindrePanneau();
              PL.annoncer("Section " + sec.titre + " renseignée en bon état.");
            }
          }, "Tout en bon état"),
          PL.el("button", {
            type: "button", class: "btn btn--petit",
            onclick: function () {
              PL.demanderTexte({
                titre: "Renommer la section", label: "Intitulé", valeur: sec.titre,
                valider: "Renommer"
              }).then(function (t) {
                if (!t) return;
                PL.maj(dossier, function () { sec.titre = t; });
                peindreNav(); peindrePanneau();
              });
            }
          }, "Renommer"),
          PL.el("button", {
            type: "button", class: "btn btn--petit btn--danger",
            onclick: function () {
              PL.confirmer({
                titre: "Supprimer « " + sec.titre + " » ?",
                message: "Les " + sec.lignes.length + " lignes de cette section seront perdues.",
                valider: "Supprimer", danger: true
              }).then(function (ok) {
                if (!ok) return;
                PL.maj(dossier, function (d) {
                  d.mobilier.sections = d.mobilier.sections.filter(function (x) {
                    return x.id !== sec.id;
                  });
                });
                courante = dossier.mobilier.sections.length
                  ? dossier.mobilier.sections[0].id : null;
                peindreNav(); peindrePanneau();
              });
            }
          }, "Supprimer la section")
        )
      ),
      PL.el("div", { class: "note" },
        "Quantité : indiquez « Ø » ou cochez « absent » si l'élément n'est pas présent. " +
        "États : TB très bon, B bon, P passable, M mauvais.")
    );

    var lignes = PL.el("div", null);

    function peindreLignes() {
      PL.vider(lignes);
      sec.lignes.forEach(function (l) {
        var segment = PL.segmente({
          label: l.libelle + " — état", valeur: l[champEtat], options: PL.ETATS_MOBILIER,
          lecture: lecture || l.absent,
          onChange: function (v) {
            PL.maj(dossier, function () { l[champEtat] = v; });
            peindreNav();
          }
        });
        if (l.absent) segment.classList.add("segmente--desactive");

        lignes.appendChild(PL.el("div", {
          class: "inv-ligne" + (l.absent ? " inv-ligne--absente" : "")
        },
          PL.el("div", { class: "inv-ligne__tete" },
            PL.el("span", { class: "inv-ligne__nom" }, l.libelle),
            PL.el("span", { style: "display:flex;gap:8px;align-items:center" },
              mode === "sortie" ? PL.etatLecture(l.etatEntree) : null,
              lecture ? null : PL.el("button", {
                type: "button", class: "btn btn--petit",
                "aria-label": "Renommer " + l.libelle,
                onclick: function () {
                  PL.demanderTexte({
                    titre: "Renommer la ligne", label: "Désignation", valeur: l.libelle,
                    valider: "Renommer"
                  }).then(function (t) {
                    if (!t) return;
                    PL.maj(dossier, function () { l.libelle = t; });
                    peindreLignes();
                  });
                }
              }, "Renommer"),
              lecture ? null : PL.el("button", {
                type: "button", class: "btn btn--petit btn--danger",
                "aria-label": "Supprimer " + l.libelle,
                onclick: function () {
                  PL.maj(dossier, function () {
                    sec.lignes = sec.lignes.filter(function (x) { return x.id !== l.id; });
                  });
                  peindreNav(); peindreLignes();
                }
              }, "×")
            )
          ),
          PL.el("div", { class: "constat-grille" },
            PL.el("div", { style: "display:flex;gap:10px;align-items:flex-end" },
              PL.el("div", { class: "inv-ligne__qte" },
                PL.champ({
                  label: "Quantité", valeur: l.qte, lecture: lecture || l.absent,
                  onChange: function (v) { PL.maj(dossier, function () { l.qte = v; }); }
                })
              ),
              PL.el("div", { style: "flex:1;margin-bottom:12px" },
                PL.caseACocher({
                  label: "Absent (Ø)", coche: l.absent, lecture: lecture,
                  onChange: function (v) {
                    PL.maj(dossier, function () {
                      l.absent = v;
                      if (v) { l.qte = "Ø"; l.etatEntree = null; l.etatSortie = null; }
                      else if (l.qte === "Ø") l.qte = "";
                    });
                    peindreNav(); peindreLignes();
                  }
                })
              )
            ),
            PL.el("div", { class: "champ" },
              PL.el("span", { class: "champ__label" },
                "État " + PL.libelleMode(mode).toLowerCase()),
              segment
            ),
            PL.champ({
              label: "Observations", valeur: l.observations, multiligne: true, rows: 2,
              large: true, lecture: lecture,
              onChange: function (v) { PL.maj(dossier, function () { l.observations = v; }); }
            })
          ),
          PL.blocPhotos({
            liste: l.photos[mode], lecture: lecture,
            onChange: function () { PL.maj(dossier, function () {}); }
          })
        ));
      });

      if (!lecture) {
        lignes.appendChild(PL.el("button", {
          type: "button", class: "btn btn--petit", style: "margin-top:10px",
          onclick: function () {
            PL.demanderTexte({
              titre: "Ajouter une ligne", label: "Désignation", valider: "Ajouter"
            }).then(function (t) {
              if (!t) return;
              PL.maj(dossier, function () { sec.lignes.push(PL.nouvelleLigne(t)); });
              peindreNav(); peindreLignes();
            });
          }
        }, "Ajouter une ligne"));
      }
    }

    peindreLignes();
    carte.appendChild(lignes);
    panneau.appendChild(carte);
  }

  peindreNav();
  peindrePanneau();

  return PL.el("div", null,
    PL.enteteDossier(dossier, mode, section),
    PL.el("div", { class: "duo" },
      PL.el("aside", { class: "duo__aside" },
        PL.el("div", { class: "carte" },
          PL.el("h2", { style: "margin-bottom:8px;font-size:0.95rem" }, "Sections"),
          nav, zoneAjout)
      ),
      panneau
    ),
    PL.piedNavigation(dossier, mode, section)
  );
};
