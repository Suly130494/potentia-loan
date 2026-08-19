/* ------------------------------------------------------------------
   Bootstrap : hub du dossier, routes, actions d'en-tête.
   ------------------------------------------------------------------ */

PL.version = "1.0.0";

/* --- hub du dossier --------------------------------------------------- */

PL.vues.hub = function (dossier, mode) {
  var prog = PL.progression(dossier, mode);
  var camp = dossier.campagnes[mode];
  var base = "/d/" + dossier.id + "/" + mode + "/";

  var racine = PL.el("div", null,
    PL.el("div", { class: "vue-entete" },
      PL.el("div", { class: "vue-entete__texte" },
        PL.el("div", { class: "vue-entete__sur" }, "Dossier"),
        PL.el("h1", null, dossier.logement.adresse || "Adresse non renseignée"),
        PL.el("div", { class: "dossier-ligne__meta" },
          (dossier.locataire.nom ? dossier.locataire.nom + " · " : "") +
          "modifié le " + PL.formaterDate(dossier.modifieLe))
      ),
      PL.el("div", { class: "app-entete__actions" },
        PL.el("button", {
          type: "button", class: "btn btn--petit",
          onclick: function () { PL.router.go("/"); }
        }, "Mes dossiers")
      )
    )
  );

  /* sélecteur de campagne */
  racine.appendChild(PL.el("section", { class: "carte" },
    PL.el("div", { class: "carte__entete" },
      PL.el("div", { class: "carte__titre" }, PL.el("h2", null, "Constat en cours")),
      PL.el("div", { class: "app-entete__actions" },
        ["entree", "sortie"].map(function (m) {
          return PL.el("button", {
            type: "button",
            class: "btn btn--petit" + (m === mode ? " btn--principal" : ""),
            "aria-current": m === mode ? "true" : "false",
            onclick: function () { PL.router.go("/d/" + dossier.id + "/" + m); }
          }, PL.libelleMode(m) + (dossier.campagnes[m].signeLe ? " ✓" : ""));
        })
      )
    ),
    PL.el("div", { class: "jauge" },
      PL.el("div", { class: "jauge__barre", style: "width:" + Math.max(2, prog.global.pourcent) + "%" })),
    PL.el("div", { class: "dossier-ligne__meta", style: "margin-top:6px" },
      prog.global.faits + " / " + prog.global.total + " postes renseignés — " +
      prog.global.pourcent + " %"),
    mode === "sortie" && !dossier.campagnes.entree.signeLe
      ? PL.el("div", { class: "note" },
          "Le constat d'entrée n'est pas encore signé. Les états d'entrée affichés en regard " +
          "restent modifiables depuis l'onglet Entrée.")
      : null,
    camp.verrouille
      ? PL.el("div", { class: "note note--alerte" },
          "Constat signé le " + PL.formaterDate(camp.signeLe) + " — lecture seule.")
      : null
  ));

  /* sections */
  var grille = PL.el("div", { class: "hub-grille" });
  PL.SECTIONS.forEach(function (s) {
    var p = prog[s.cle];
    var complet = p.total > 0 && p.faits >= p.total;
    grille.appendChild(PL.el("button", {
      type: "button", class: "hub-item",
      onclick: function () { PL.router.go(base + s.cle); }
    },
      PL.el("span", null,
        PL.el("span", { class: "hub-item__titre" }, s.titre),
        PL.el("span", { class: "hub-item__sous", style: "display:block" }, s.sous)
      ),
      PL.el("span", {
        class: "hub-item__compte" + (complet ? " hub-item__compte--complet" : "")
      }, p.faits + "/" + p.total)
    ));
  });
  racine.appendChild(grille);

  /* documents */
  racine.appendChild(PL.el("section", { class: "carte", style: "margin-top:16px" },
    PL.el("div", { class: "carte__entete" }, PL.el("h2", null, "Documents")),
    PL.el("p", { class: "dossier-ligne__meta" },
      "L'impression ouvre la boîte de dialogue du navigateur : choisissez « Enregistrer au " +
      "format PDF » comme destination, format A4, et activez les en-têtes si vous souhaitez " +
      "la numérotation des pages."),
    PL.el("div", { class: "app-entete__actions", style: "margin-top:10px" },
      PL.el("button", {
        type: "button", class: "btn btn--principal",
        onclick: function () { PL.print.lancer("edl", dossier, mode); }
      }, "Imprimer l'état des lieux"),
      PL.el("button", {
        type: "button", class: "btn",
        onclick: function () { PL.print.lancer("mobilier", dossier, mode); }
      }, "Imprimer l'inventaire"),
      PL.el("button", {
        type: "button", class: "btn",
        onclick: function () { PL.print.lancer("complet", dossier, mode); }
      }, "Imprimer le dossier complet"),
      mode === "sortie" ? PL.el("button", {
        type: "button", class: "btn",
        onclick: function () { PL.print.lancer("ecarts", dossier, mode); }
      }, "Imprimer le récapitulatif des écarts") : null
    )
  ));

  /* écarts entrée/sortie */
  if (mode === "sortie") {
    var ecarts = PL.print.calculerEcarts(dossier);
    racine.appendChild(PL.el("section", { class: "carte" },
      PL.el("div", { class: "carte__entete" },
        PL.el("h2", null, "Écarts entrée / sortie"),
        PL.el("span", { class: "hub-item__compte" }, String(ecarts.length))),
      ecarts.length
        ? PL.el("div", null,
            PL.el("p", { class: "dossier-ligne__meta" },
              "Postes dont l'état s'est dégradé entre l'entrée et la sortie. " +
              "Ce récapitulatif est imprimable en annexe."),
            PL.el("ul", { class: "liste-manques" },
              ecarts.slice(0, 12).map(function (e) {
                return PL.el("li", null,
                  e.zone + " — " + e.libelle + " : " + (e.entree || "—") + " → " + (e.sortie || "—"));
              }),
              ecarts.length > 12
                ? PL.el("li", null, "… et " + (ecarts.length - 12) + " autres.") : null)
          )
        : PL.el("p", { class: "dossier-ligne__meta" },
            "Aucune dégradation constatée pour l'instant.")
    ));
  }

  /* gestion du dossier */
  racine.appendChild(PL.el("section", { class: "carte carte--sourde" },
    PL.el("div", { class: "carte__entete" }, PL.el("h2", null, "Dossier")),
    PL.el("div", { class: "app-entete__actions" },
      PL.boutonEnvoi(dossier.id),
      PL.el("button", {
        type: "button", class: "btn btn--petit",
        onclick: function () {
          var id = PL.store.duplicate(dossier.id);
          PL.toast("Dossier dupliqué.");
          PL.router.go("/d/" + id + "/entree");
        }
      }, "Dupliquer")
    )
  ));

  return racine;
};

/* --- routes ------------------------------------------------------------ */

(function () {
  function avecDossier(params, rendu) {
    var dossier = PL.store.get(params.id);
    if (!dossier) {
      return PL.el("div", { class: "etat-vide" },
        PL.el("p", null, "Ce dossier n'existe pas ou a été supprimé."),
        PL.el("button", {
          type: "button", class: "btn btn--principal",
          onclick: function () { PL.router.go("/"); }
        }, "Retour à mes dossiers"));
    }
    var mode = params.mode === "sortie" ? "sortie" : "entree";
    return rendu(dossier, mode);
  }

  PL.router.define("/", function () { return PL.vues.accueil(); });

  PL.router.define("/aide", function () { return PL.vues.aide(); });

  PL.router.define("/d/:id/:mode", function (p) {
    return avecDossier(p, function (d, m) { return PL.vues.hub(d, m); });
  });

  PL.router.define("/d/:id/:mode/:section", function (p) {
    return avecDossier(p, function (d, m) {
      var vue = PL.vues[p.section];
      if (!vue) {
        PL.router.go("/d/" + d.id + "/" + m);
        return null;
      }
      return vue(d, m);
    });
  });
})();

/* --- actions permanentes de l'en-tête ---------------------------------- */

(function () {
  var zone = document.getElementById("app-actions");

  function themeCourant() {
    return document.documentElement.getAttribute("data-theme") ||
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark" : "light");
  }

  var bouton = PL.el("button", {
    type: "button", class: "btn btn--petit btn--discret",
    "aria-label": "Basculer entre le thème clair et le thème sombre",
    onclick: function () {
      var nouveau = themeCourant() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nouveau);
      try { window.localStorage.setItem("potentia-loan:theme", nouveau); } catch (e) {}
      bouton.textContent = nouveau === "dark" ? "Thème clair" : "Thème sombre";
    }
  }, themeCourant() === "dark" ? "Thème clair" : "Thème sombre");

  try {
    var memo = window.localStorage.getItem("potentia-loan:theme");
    if (memo) {
      document.documentElement.setAttribute("data-theme", memo);
      bouton.textContent = memo === "dark" ? "Thème clair" : "Thème sombre";
    }
  } catch (e) {}

  zone.appendChild(PL.el("button", {
    type: "button", class: "btn btn--petit btn--discret",
    onclick: function () { PL.router.go("/"); }
  }, "Mes dossiers"));
  zone.appendChild(PL.el("button", {
    type: "button", class: "btn btn--petit btn--discret",
    onclick: function () { PL.router.go("/aide"); }
  }, "Aide"));
  zone.appendChild(bouton);
})();

/* Demande au navigateur de conserver durablement les données. Sans cela,
   un nettoyage automatique peut effacer un dossier que personne n'a rouvert
   depuis des mois — exactement le cas d'un constat d'entrée en attente de
   sa sortie. Refus éventuel sans conséquence : l'application fonctionne
   comme avant, et la notice insiste sur la copie hors de l'appareil. */
(function () {
  if (!navigator.storage || !navigator.storage.persist) return;
  navigator.storage.persisted().then(function (dejaAccorde) {
    if (dejaAccorde) return null;
    return navigator.storage.persist();
  }).catch(function () { /* rien à faire : ce n'est qu'une demande */ });
})();

PL.router.demarrer();
