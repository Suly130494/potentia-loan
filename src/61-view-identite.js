/* ------------------------------------------------------------------
   Vue « Identité » : logement, bailleur, locataire, campagne.
   Saisie une seule fois, alimente les deux documents imprimés.
   ------------------------------------------------------------------ */

PL.maj = function (dossier, fn) {
  var res = PL.store.patch(dossier.id, fn);
  if (!res.ok && res.erreur) PL.toast(res.erreur);
};

PL.vues.identite = function (dossier, mode) {
  var lecture = PL.estVerrouille(dossier, mode);
  var camp = dossier.campagnes[mode];
  var section = PL.SECTIONS[0];

  function champ(label, objet, cle, options) {
    var o = options || {};
    return PL.champ({
      label: label, valeur: objet[cle], lecture: lecture,
      type: o.type, suffixe: o.suffixe, multiligne: o.multiligne,
      large: o.large, placeholder: o.placeholder,
      onChange: function (v) { PL.maj(dossier, function () { objet[cle] = v; }); }
    });
  }

  if (!camp.date) {
    PL.maj(dossier, function (d) { d.campagnes[mode].date = PL.dateJour(); });
  }

  return PL.el("div", null,
    PL.enteteDossier(dossier, mode, section),

    PL.el("section", { class: "carte" },
      PL.el("div", { class: "carte__entete" }, PL.el("h2", null, "Logement")),
      PL.el("div", { class: "grille-champs" },
        champ("Adresse complète", dossier.logement, "adresse",
          { multiligne: true, large: true, placeholder: "Numéro, voie, code postal, commune" }),
        champ("Bâtiment", dossier.logement, "batiment"),
        champ("Escalier", dossier.logement, "escalier"),
        champ("Étage", dossier.logement, "etage"),
        champ("Porte", dossier.logement, "porte")
      )
    ),

    PL.el("section", { class: "carte" },
      PL.el("div", { class: "carte__entete" }, PL.el("h2", null, "Bailleur")),
      PL.el("div", { class: "grille-champs" },
        champ("Nom ou désignation", dossier.bailleur, "nom", { large: true }),
        champ("Adresse", dossier.bailleur, "adresse", { multiligne: true, large: true })
      )
    ),

    PL.el("section", { class: "carte" },
      PL.el("div", { class: "carte__entete" }, PL.el("h2", null, "Locataire")),
      PL.el("div", { class: "grille-champs" },
        champ("Nom", dossier.locataire, "nom", { large: true }),
        champ("Adresse à l'entrée", dossier.locataire, "adresseEntree", { multiligne: true }),
        champ("Nouvelle adresse (à la sortie)", dossier.locataire, "adresseSortie",
          { multiligne: true })
      )
    ),

    PL.el("section", { class: "carte" },
      PL.el("div", { class: "carte__entete" },
        PL.el("h2", null, "Constat " + PL.deMode(mode))),
      PL.el("div", { class: "grille-champs" },
        champ("Date du constat", camp, "date", { type: "date" }),
        champ("Fait à", camp, "lieu", { placeholder: "Commune" }),
        champ("Nombre d'exemplaires originaux", camp, "nbExemplaires", { type: "number" })
      )
    ),

    PL.piedNavigation(dossier, mode, section)
  );
};
