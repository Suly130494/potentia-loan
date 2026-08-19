/* ------------------------------------------------------------------
   Écran d'accueil : liste des dossiers + helpers partagés par les vues.
   ------------------------------------------------------------------ */

PL.vues = PL.vues || {};

PL.SECTIONS = [
  { cle: "identite", titre: "Identité", sous: "Logement, bailleur, locataire" },
  { cle: "compteurs", titre: "Compteurs", sous: "Relevés eau, gaz, électricité" },
  { cle: "technique", titre: "Chauffage & divers", sous: "Chauffage, clés, sécurité" },
  { cle: "pieces", titre: "Pièces", sous: "Plafond, murs, sol" },
  { cle: "equipements", titre: "Équipements", sous: "Cuisine, salle d'eau, WC" },
  { cle: "mobilier", titre: "Inventaire mobilier", sous: "Annexe du bail meublé" },
  { cle: "signatures", titre: "Signatures", sous: "Lu et approuvé" }
];

PL.estVerrouille = function (dossier, mode) {
  return !!dossier.campagnes[mode].verrouille;
};

PL.libelleMode = function (mode) {
  return mode === "sortie" ? "Sortie" : "Entrée";
};

/* « de entrée » est fautif : l'élision se fait devant la voyelle. */
PL.deMode = function (mode) {
  return mode === "sortie" ? "de sortie" : "d'entrée";
};

/* Le dossier n'existe que dans ce navigateur : tant qu'aucune copie n'en est
   sortie, une panne ou un nettoyage du téléphone l'efface sans recours. Le
   badge rend cet état visible en permanence plutôt qu'au moment du drame. */
PL.badgeSauvegarde = function (resume) {
  if (resume.statutSauvegarde === "jamais") {
    return PL.el("span", {
      class: "badge badge--alerte",
      title: "Ce dossier n'existe que sur cet appareil"
    }, "Jamais sauvegardé");
  }
  if (resume.statutSauvegarde === "obsolete") {
    return PL.el("span", {
      class: "badge badge--alerte",
      title: "Modifié depuis le dernier envoi du " + PL.formaterDate(resume.sauvegardeLe)
    }, "Sauvegarde à refaire");
  }
  return PL.el("span", {
    class: "badge", title: "Dernier envoi le " + PL.formaterDate(resume.sauvegardeLe)
  }, "Sauvegardé");
};

/* Bouton d'envoi du dossier. Un seul bouton, dont le libellé suit ce que
   l'appareil sait faire : partage natif sur mobile et tablette, simple
   téléchargement ailleurs. Deux boutons distincts feraient doublon sur les
   appareils où le partage n'existe pas. */
PL.boutonEnvoi = function (id, classe) {
  var partage = PL.store.partageDisponible();
  var bouton = PL.el("button", {
    type: "button", class: classe || "btn btn--petit",
    onclick: function () {
      bouton.disabled = true;
      PL.toast("Préparation du dossier…");
      (partage ? PL.store.partager(id) : PL.store.exportJSON(id)).then(function (r) {
        bouton.disabled = false;
        if (!r || !r.ok) {
          PL.toast("Envoi impossible : " + ((r && r.erreur) || "erreur inconnue"));
          return;
        }
        if (r.annule) return;
        PL.toast((r.methode === "partage" ? "Dossier envoyé" : "Dossier téléchargé") +
          " — " + r.photos + " photo(s), " + PL.formaterOctets(r.octets) + ".");
        /* Le badge de sauvegarde vient de changer d'état : sans ce rendu, il
           continuerait d'afficher « Jamais sauvegardé » après un envoi réussi. */
        PL.router.rafraichir();
      });
    }
  }, partage ? "Envoyer le dossier" : "Exporter le dossier");
  return bouton;
};

/* En-tête commun aux vues d'une section de dossier. */
PL.enteteDossier = function (dossier, mode, section) {
  var verrou = PL.estVerrouille(dossier, mode);
  var i = PL.SECTIONS.findIndex(function (s) { return s.cle === section.cle; });
  var precedent = PL.SECTIONS[i - 1];
  var suivant = PL.SECTIONS[i + 1];
  var base = "/d/" + dossier.id + "/" + mode + "/";

  return PL.el("div", null,
    PL.el("div", { class: "vue-entete" },
      PL.el("div", { class: "vue-entete__texte" },
        PL.el("div", { class: "vue-entete__sur" },
          PL.libelleMode(mode) + " · " + (dossier.logement.adresse || "adresse non renseignée")),
        PL.el("h1", null, section.titre)
      ),
      PL.el("div", { class: "app-entete__actions" },
        precedent ? PL.el("button", {
          type: "button", class: "btn btn--petit",
          onclick: function () { PL.router.go(base + precedent.cle); }
        }, "‹ " + precedent.titre) : null,
        suivant ? PL.el("button", {
          type: "button", class: "btn btn--petit",
          onclick: function () { PL.router.go(base + suivant.cle); }
        }, suivant.titre + " ›") : null,
        PL.el("button", {
          type: "button", class: "btn btn--petit",
          onclick: function () { PL.router.go("/d/" + dossier.id + "/" + mode); }
        }, "Sommaire")
      )
    ),
    verrou ? PL.el("div", { class: "note note--alerte" },
      "Ce constat " + PL.deMode(mode) +
      " est signé et verrouillé. Les champs sont en lecture seule.") : null
  );
};

/* Pied de navigation identique en bas de chaque section. */
PL.piedNavigation = function (dossier, mode, section) {
  var i = PL.SECTIONS.findIndex(function (s) { return s.cle === section.cle; });
  var suivant = PL.SECTIONS[i + 1];
  var base = "/d/" + dossier.id + "/" + mode + "/";
  return PL.el("div", { class: "barre-actions" },
    PL.el("button", {
      type: "button", class: "btn",
      onclick: function () { PL.router.go("/d/" + dossier.id + "/" + mode); }
    }, "Retour au sommaire"),
    suivant ? PL.el("button", {
      type: "button", class: "btn btn--principal",
      onclick: function () { PL.router.go(base + suivant.cle); }
    }, "Continuer : " + suivant.titre) : null
  );
};

/* --- accueil --------------------------------------------------------- */

PL.vues.accueil = function () {
  var racine = PL.el("div", null);
  var dossiers = PL.store.list();
  var actifs = dossiers.filter(function (d) { return !d.archive; });
  var archives = dossiers.filter(function (d) { return d.archive; });

  racine.appendChild(PL.el("div", { class: "vue-entete" },
    PL.el("div", { class: "vue-entete__texte" },
      PL.el("div", { class: "vue-entete__sur" }, "Constats locatifs"),
      PL.el("h1", null, "Mes dossiers")
    ),
    PL.el("div", { class: "app-entete__actions" },
      PL.el("button", {
        type: "button", class: "btn btn--principal",
        onclick: function () {
          var id = PL.store.create();
          PL.router.go("/d/" + id + "/entree/identite");
        }
      }, "Nouveau dossier"),
      boutonImport()
    )
  ));

  var erreur = PL.store.erreur();
  if (erreur) racine.appendChild(PL.el("div", { class: "note note--alerte" }, erreur));

  if (!actifs.length && !archives.length) {
    racine.appendChild(PL.el("div", { class: "etat-vide" },
      PL.el("p", null, "Aucun dossier pour le moment."),
      PL.el("p", null,
        "Créez un dossier pour établir un état des lieux d'entrée, " +
        "ou importez un dossier existant au format JSON.")
    ));
  } else {
    racine.appendChild(liste(actifs));
    if (archives.length) {
      racine.appendChild(PL.el("h2", { style: "margin:22px 0 10px" },
        "Archivés (" + archives.length + ")"));
      racine.appendChild(liste(archives));
    }
  }

  racine.appendChild(blocStockage());
  var aSauvegarder = actifs.filter(function (d) {
    return d.statutSauvegarde !== "a-jour";
  }).length;
  if (aSauvegarder) {
    racine.appendChild(PL.el("div", { class: "note note--alerte" },
      aSauvegarder === 1
        ? "Un dossier n'a pas de copie hors de cet appareil. Envoyez-le-vous par mail : "
          + "c'est ce qui vous permettra de le retrouver dans plusieurs années."
        : aSauvegarder + " dossiers n'ont pas de copie hors de cet appareil. Envoyez-les-vous "
          + "par mail : c'est ce qui vous permettra de les retrouver dans plusieurs années."));
  }

  racine.appendChild(PL.el("div", { class: "note" },
    PL.el("span", null,
      "Les dossiers sont enregistrés dans ce navigateur uniquement. "),
    PL.el("button", {
      type: "button", class: "btn btn--petit btn--discret",
      style: "text-decoration:underline",
      onclick: function () { PL.router.go("/aide"); }
    }, "Comment retrouver un dossier dans plusieurs années ?")
  ));

  return racine;

  function liste(items) {
    var ul = PL.el("div", { class: "liste-dossiers" });
    items.forEach(function (d) { ul.appendChild(ligne(d)); });
    return ul;
  }

  function ligne(d) {
    var badges = PL.el("span", null,
      d.signeEntree ? PL.el("span", { class: "badge badge--signe" }, "Entrée signée") : null,
      " ",
      d.signeSortie ? PL.el("span", { class: "badge badge--sortie" }, "Sortie signée") : null,
      " ",
      PL.badgeSauvegarde(d)
    );
    return PL.el("div", { class: "dossier-ligne" },
      PL.el("div", { class: "dossier-ligne__info" },
        PL.el("div", { class: "dossier-ligne__titre" }, d.titre),
        PL.el("div", { class: "dossier-ligne__meta" },
          (d.locataire ? d.locataire + " · " : "") +
          "modifié le " + PL.formaterDate(d.modifieLe) + " · " + d.avancement + " %"),
        badges
      ),
      PL.el("div", { class: "dossier-ligne__actions" },
        PL.el("button", {
          type: "button", class: "btn btn--petit btn--principal",
          onclick: function () {
            PL.router.go("/d/" + d.id + "/" + (d.signeEntree ? "sortie" : "entree"));
          }
        }, d.signeEntree ? "Ouvrir (sortie)" : "Ouvrir"),
        PL.boutonEnvoi(d.id),
        PL.el("button", {
          type: "button", class: "btn btn--petit",
          onclick: function () {
            PL.store.duplicate(d.id);
            PL.toast("Dossier dupliqué.");
            PL.router.rafraichir();
          }
        }, "Dupliquer"),
        PL.el("button", {
          type: "button", class: "btn btn--petit",
          onclick: function () {
            PL.store.patch(d.id, function (x) { x.archive = !x.archive; });
            PL.router.rafraichir();
          }
        }, d.archive ? "Désarchiver" : "Archiver"),
        PL.el("button", {
          type: "button", class: "btn btn--petit btn--danger",
          onclick: function () {
            PL.confirmer({
              titre: "Supprimer ce dossier ?",
              message: "« " + d.titre + " » et ses photos seront définitivement effacés " +
                "de cet appareil. Cette action est irréversible. Pensez à exporter le " +
                "dossier avant si vous souhaitez le conserver.",
              valider: "Supprimer définitivement", danger: true
            }).then(function (ok) {
              if (!ok) return;
              PL.store.remove(d.id);
              PL.toast("Dossier supprimé.");
              PL.router.rafraichir();
            });
          }
        }, "Supprimer")
      )
    );
  }

  function boutonImport() {
    var input = PL.el("input", { type: "file", accept: "application/json,.json" });
    input.style.display = "none";
    input.addEventListener("change", function () {
      var f = input.files && input.files[0];
      input.value = "";
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        var res = PL.store.importJSON(String(fr.result));
        if (res.ok) {
          PL.toast("Dossier importé" +
            (res.photos ? " — " + res.photos + " photo(s) restaurée(s)." : "."));
          PL.router.go("/d/" + res.id + "/entree");
        } else {
          PL.dialogue({
            titre: "Import impossible",
            corps: PL.el("p", null, res.erreur),
            actions: [{ libelle: "Fermer", principal: true }]
          });
        }
      };
      fr.readAsText(f);
    });
    var b = PL.el("button", {
      type: "button", class: "btn", onclick: function () { input.click(); }
    }, "Importer un JSON");
    return PL.el("span", null, input, b);
  }

  function blocStockage() {
    var u = PL.store.usage();
    var bloc = PL.el("div", { class: "carte carte--sourde", style: "margin-top:22px" },
      PL.el("div", { class: "carte__entete" },
        PL.el("strong", null, "Stockage de cet appareil"),
        PL.el("span", { class: "dossier-ligne__meta" },
          "Données : " + PL.formaterOctets(u.octets))
      ),
      PL.el("div", { class: "jauge" },
        PL.el("div", {
          class: "jauge__barre" + (u.pourcent > 80 ? " jauge__barre--alerte" : ""),
          style: "width:" + Math.max(2, u.pourcent) + "%"
        })
      )
    );
    PL.photos.usage().then(function (octets) {
      bloc.appendChild(PL.el("div", { class: "dossier-ligne__meta", style: "margin-top:6px" },
        "Photos : " + PL.formaterOctets(octets) + " (stockées séparément, sans limite étroite)"));
    });
    return bloc;
  }
};
