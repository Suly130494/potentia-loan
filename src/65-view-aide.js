/* ------------------------------------------------------------------
   Notice « retrouver mon dossier ». Le constat de sortie a lieu des
   années après celui d'entrée : personne ne se souviendra de la marche
   à suivre. Elle est donc écrite dans l'application elle-même.
   ------------------------------------------------------------------ */

PL.vues.aide = function () {
  var persistant = null;
  var blocPersistance = PL.el("p", { class: "dossier-ligne__meta" },
    "Vérification de la protection du stockage…");

  if (navigator.storage && navigator.storage.persisted) {
    navigator.storage.persisted().then(function (ok) {
      persistant = ok;
      PL.vider(blocPersistance);
      blocPersistance.appendChild(document.createTextNode(
        ok
          ? "Sur cet appareil, le stockage de l'application est protégé contre "
            + "l'effacement automatique."
          : "Sur cet appareil, le stockage n'est pas protégé contre l'effacement "
            + "automatique. Installez l'application sur l'écran d'accueil et gardez "
            + "toujours une copie du dossier hors de l'appareil."));
    });
  } else {
    blocPersistance.textContent =
      "Ce navigateur ne permet pas de savoir si le stockage est protégé. "
      + "Gardez toujours une copie du dossier hors de l'appareil.";
  }

  function etape(numero, titre) {
    var contenus = Array.prototype.slice.call(arguments, 2);
    return PL.el("section", { class: "carte" },
      PL.el("div", { class: "carte__entete" },
        PL.el("div", { class: "carte__titre" },
          PL.el("span", { class: "hub-item__compte" }, String(numero)),
          PL.el("h2", null, titre))),
      contenus);
  }

  return PL.el("div", null,
    PL.el("div", { class: "vue-entete" },
      PL.el("div", { class: "vue-entete__texte" },
        PL.el("div", { class: "vue-entete__sur" }, "Notice"),
        PL.el("h1", null, "Retrouver un dossier dans plusieurs années")),
      PL.el("div", { class: "app-entete__actions" },
        PL.el("button", {
          type: "button", class: "btn btn--petit",
          onclick: function () { PL.router.go("/"); }
        }, "Mes dossiers"))
    ),

    PL.el("div", { class: "note note--alerte" },
      "Un dossier n'existe que dans le navigateur de l'appareil qui l'a créé. "
      + "Changer de téléphone, réinstaller le navigateur ou effacer les données de "
      + "navigation le supprime définitivement. La seule protection est d'en garder "
      + "une copie ailleurs."),

    etape(1, "Installer l'application sur l'écran d'accueil",
      PL.el("div", null,
        PL.el("p", null,
          "À faire une fois, avant le premier constat. Sans cela, un iPhone efface "
          + "les données d'un site qui n'a pas été ouvert pendant sept jours."),
        PL.el("p", null,
          PL.el("strong", null, "Sur iPhone et iPad : "),
          "bouton Partager (le carré avec une flèche), puis « Sur l'écran d'accueil »."),
        PL.el("p", null,
          PL.el("strong", null, "Sur Android : "),
          "menu à trois points, puis « Installer l'application » ou "
          + "« Ajouter à l'écran d'accueil »."),
        blocPersistance)),

    etape(2, "Sauvegarder le dossier à la fin du constat",
      PL.el("div", null,
        PL.el("p", null,
          "Depuis le sommaire du dossier, appuyez sur « Envoyer le dossier », "
          + "puis choisissez Mail. Envoyez-le-vous à vous-même, et mettez en copie "
          + "l'autre partie."),
        PL.el("p", null,
          "Deux personnes ont alors la copie : si l'une la perd, l'autre l'a. "
          + "Une boîte mail survit aux changements de téléphone, et se cherche."),
        PL.el("p", null,
          PL.el("strong", null, "Objet du message : "),
          "reprenez le nom du fichier, il contient déjà la date, la nature du constat "
          + "et l'adresse."),
        PL.el("p", { style: "margin-bottom:0" },
          "Envoyez également le PDF : c'est lui le document signé qui fait foi, et il "
          + "se lit partout. Le fichier de dossier, lui, sert à reprendre le travail."))),

    etape(3, "Rouvrir le dossier des années plus tard",
      PL.el("p", null,
        "Cherchez « état des lieux » dans votre boîte mail, puis ouvrez le message."),
      PL.el("ol", { class: "liste-manques", style: "font-size:0.9rem" },
          PL.el("li", null,
            "Appuyez longuement sur la pièce jointe qui se termine par « .json », "
            + "puis enregistrez-la dans Fichiers."),
          PL.el("li", null,
            "Ouvrez Potentia Loan depuis l'écran d'accueil."),
          PL.el("li", null,
            "Appuyez sur « Importer un JSON », puis sélectionnez le fichier enregistré."),
          PL.el("li", null,
            "Le dossier réapparaît avec ses photos. Basculez sur « Sortie » : "
            + "chaque état d'entrée s'affiche en regard, il n'y a plus qu'à constater."))),

    etape(4, "Ce qu'il faut conserver",
      PL.el("div", null,
        PL.el("p", null,
          PL.el("strong", null, "Le PDF signé"),
          " — c'est la pièce qui fait foi entre les parties. Chacune doit en avoir "
          + "un exemplaire, sur papier ou sous forme électronique."),
        PL.el("p", { style: "margin-bottom:0" },
          PL.el("strong", null, "Le fichier de dossier (.json)"),
          " — il n'a pas de valeur juridique et ne remplace pas le PDF, mais lui "
          + "seul permet de rouvrir le constat pour établir celui de sortie."))),

    PL.el("div", { class: "barre-actions" },
      PL.el("button", {
        type: "button", class: "btn btn--principal",
        onclick: function () { PL.router.go("/"); }
      }, "Retour à mes dossiers"))
  );
};
