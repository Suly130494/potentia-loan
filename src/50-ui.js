/* ------------------------------------------------------------------
   Socle d'interface : fabrique d'éléments, composants de saisie,
   routeur, dialogues. Aucune connaissance du métier.
   ------------------------------------------------------------------ */

PL.el = function (tag, props) {
  var n = document.createElement(tag);
  var enfants = Array.prototype.slice.call(arguments, 2);
  if (props) {
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") n.className = v;
      else if (k === "texte") n.textContent = v;
      else if (k.slice(0, 2) === "on" && typeof v === "function") {
        n.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === "dataset") {
        Object.keys(v).forEach(function (d) { n.dataset[d] = v[d]; });
      } else if (k in n && k !== "list" && typeof v !== "object") {
        try { n[k] = v; } catch (e) { n.setAttribute(k, v); }
      } else {
        n.setAttribute(k, v === true ? "" : v);
      }
    });
  }
  enfants.forEach(function ajouter(c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(ajouter); return; }
    n.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
  });
  return n;
};

PL.vider = function (n) { while (n.firstChild) n.removeChild(n.firstChild); return n; };

PL.annoncer = function (message) {
  var z = document.getElementById("zone-annonces");
  if (z) { z.textContent = ""; setTimeout(function () { z.textContent = message; }, 30); }
};

var minuteurToast = null;
PL.toast = function (message) {
  var ancien = document.querySelector(".toast");
  if (ancien) ancien.remove();
  var t = PL.el("div", { class: "toast", role: "status" }, message);
  document.body.appendChild(t);
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(function () { t.remove(); }, 3800);
};

/* --- champs -------------------------------------------------------- */

PL.champ = function (o) {
  var saisie;
  if (o.multiligne) {
    saisie = PL.el("textarea", {
      value: o.valeur || "", rows: o.rows || 3,
      placeholder: o.placeholder || "", disabled: !!o.lecture
    });
  } else {
    saisie = PL.el("input", {
      type: o.type || "text",
      value: o.valeur == null ? "" : o.valeur,
      inputmode: o.type === "number" ? "decimal" : null,
      placeholder: o.placeholder || "",
      list: o.liste || null,
      disabled: !!o.lecture
    });
  }
  saisie.addEventListener("input", function () { o.onChange(saisie.value); });
  var id = "c" + PL.uid().slice(0, 8);
  saisie.id = id;
  return PL.el("label", { class: "champ" + (o.large ? " champ--large" : ""), "for": id },
    PL.el("span", { class: "champ__label" }, o.label),
    PL.el("span", { class: "champ__saisie" },
      saisie,
      o.suffixe ? PL.el("span", { class: "champ__suffixe" }, o.suffixe) : null
    )
  );
};

PL.datalist = function (id, valeurs) {
  return PL.el("datalist", { id: id },
    valeurs.map(function (v) { return PL.el("option", { value: v }); }));
};

PL.caseACocher = function (o) {
  var input = PL.el("input", { type: "checkbox", checked: !!o.coche, disabled: !!o.lecture });
  var wrap = PL.el("label", { class: "case" + (o.coche ? " case--cochee" : "") },
    input, PL.el("span", null, o.label));
  input.addEventListener("change", function () {
    wrap.classList.toggle("case--cochee", input.checked);
    o.onChange(input.checked);
  });
  return wrap;
};

/* --- sélecteur d'état segmenté -------------------------------------- */

PL.segmente = function (o) {
  var groupe = PL.el("div", {
    class: "segmente" + (o.desactive ? " segmente--desactive" : ""),
    role: "radiogroup",
    "aria-label": o.label
  });
  var boutons = [];

  function majuscule(valeur) {
    boutons.forEach(function (b) {
      var actif = b.dataset.code === valeur;
      b.setAttribute("aria-checked", actif ? "true" : "false");
      b.tabIndex = actif || (!valeur && b === boutons[0]) ? 0 : -1;
    });
  }

  o.options.forEach(function (opt) {
    var b = PL.el("button", {
      type: "button", class: "segmente__opt", role: "radio",
      "aria-checked": "false", "aria-label": opt.libelle,
      title: opt.libelle, dataset: { code: opt.code }, disabled: !!o.lecture
    }, opt.code);
    b.addEventListener("click", function () {
      var nouvelle = o.valeur === opt.code && o.effacable !== false ? null : opt.code;
      o.valeur = nouvelle;
      majuscule(nouvelle);
      o.onChange(nouvelle);
    });
    b.addEventListener("keydown", function (e) {
      var i = boutons.indexOf(b), suivant = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") suivant = boutons[(i + 1) % boutons.length];
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") suivant = boutons[(i - 1 + boutons.length) % boutons.length];
      if (suivant) { e.preventDefault(); suivant.focus(); suivant.click(); }
    });
    boutons.push(b);
    groupe.appendChild(b);
  });

  majuscule(o.valeur);
  return groupe;
};

PL.etatLecture = function (code, prefixe) {
  return PL.el("span", { class: "etat-lecture" },
    PL.el("span", null, prefixe || "Entrée :"),
    PL.el("span", { class: "etat-lecture__pastille" }, code || "—"));
};

/* --- dialogues ------------------------------------------------------ */

PL.dialogue = function (o) {
  var calque = PL.el("div", { class: "calque" });
  var boite = PL.el("div", {
    class: "dialogue", role: "dialog", "aria-modal": "true", "aria-label": o.titre
  });
  var focusPrecedent = document.activeElement;

  function fermer() {
    calque.remove();
    document.removeEventListener("keydown", surTouche);
    if (focusPrecedent && focusPrecedent.focus) focusPrecedent.focus();
  }
  function surTouche(e) {
    if (e.key === "Escape") { e.preventDefault(); fermer(); }
    if (e.key === "Tab") {
      var cibles = boite.querySelectorAll("button, input, textarea, select, [href]");
      if (!cibles.length) return;
      var premier = cibles[0], dernier = cibles[cibles.length - 1];
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    }
  }

  boite.appendChild(PL.el("h2", { class: "dialogue__titre" }, o.titre));
  if (o.corps) boite.appendChild(o.corps);
  var actions = PL.el("div", { class: "dialogue__actions" });
  (o.actions || []).forEach(function (a) {
    actions.appendChild(PL.el("button", {
      type: "button",
      class: "btn" + (a.principal ? " btn--principal" : "") + (a.danger ? " btn--danger" : ""),
      onclick: function () { if (!a.onClick || a.onClick() !== false) fermer(); }
    }, a.libelle));
  });
  boite.appendChild(actions);
  calque.appendChild(boite);
  calque.addEventListener("mousedown", function (e) { if (e.target === calque) fermer(); });
  document.addEventListener("keydown", surTouche);
  document.getElementById("calque-dialogues").appendChild(calque);

  var premierChamp = boite.querySelector("input, textarea, button");
  if (premierChamp) premierChamp.focus();
  return { fermer: fermer };
};

PL.confirmer = function (o) {
  return new Promise(function (resoudre) {
    PL.dialogue({
      titre: o.titre,
      corps: PL.el("p", null, o.message),
      actions: [
        { libelle: o.annuler || "Annuler", onClick: function () { resoudre(false); } },
        {
          libelle: o.valider || "Confirmer", principal: !o.danger, danger: !!o.danger,
          onClick: function () { resoudre(true); }
        }
      ]
    });
  });
};

PL.demanderTexte = function (o) {
  return new Promise(function (resoudre) {
    var valeur = o.valeur || "";
    var corps = PL.champ({
      label: o.label, valeur: valeur, large: true,
      onChange: function (v) { valeur = v; }
    });
    PL.dialogue({
      titre: o.titre,
      corps: corps,
      actions: [
        { libelle: "Annuler", onClick: function () { resoudre(null); } },
        {
          libelle: o.valider || "Valider", principal: true,
          onClick: function () { resoudre(valeur.trim() || null); }
        }
      ]
    });
  });
};

/* --- routeur -------------------------------------------------------- */

(function () {
  var routes = [];
  var rendus = 0;

  function analyser(hash) {
    var chemin = (hash || "").replace(/^#/, "");
    if (!chemin || chemin === "/") return { segments: [] };
    return { segments: chemin.replace(/^\//, "").split("/").map(decodeURIComponent) };
  }

  function apparier(motif, segments) {
    var parts = motif.replace(/^\//, "").split("/").filter(Boolean);
    if (motif === "/" && segments.length === 0) return {};
    if (parts.length !== segments.length) return null;
    var params = {};
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].charAt(0) === ":") params[parts[i].slice(1)] = segments[i];
      else if (parts[i] !== segments[i]) return null;
    }
    return params;
  }

  function rendre() {
    var vue = document.getElementById("vue");
    var segments = analyser(window.location.hash).segments;
    for (var i = 0; i < routes.length; i++) {
      var params = apparier(routes[i].motif, segments);
      if (params) {
        PL.vider(vue);
        var contenu;
        try {
          contenu = routes[i].rendu(params);
        } catch (e) {
          contenu = PL.el("div", { class: "note note--alerte" },
            "Erreur d'affichage : " + (e && e.message ? e.message : e));
          if (window.console) window.console.error(e);
        }
        if (contenu) vue.appendChild(contenu);
        if (rendus++) vue.focus();
        window.scrollTo(0, 0);
        return;
      }
    }
    window.location.hash = "#/";
  }

  PL.router = {
    define: function (motif, rendu) { routes.push({ motif: motif, rendu: rendu }); },
    go: function (chemin) {
      if (("#" + chemin) === window.location.hash) rendre();
      else window.location.hash = "#" + chemin;
    },
    rafraichir: rendre,
    demarrer: function () {
      window.addEventListener("hashchange", rendre);
      rendre();
    }
  };
})();

/* --- bloc photos ----------------------------------------------------- */

PL.blocPhotos = function (o) {
  /* o : { liste, onChange(liste), lecture, label } */
  var conteneur = PL.el("div", { class: "photos" });
  var grille = PL.el("div", { class: "photos__grille" });

  function peindre() {
    PL.vider(grille);
    (o.liste || []).forEach(function (ref) {
      var vignette = PL.el("div", { class: "photo-vignette" });
      PL.photos.get(ref.id).then(function (data) {
        if (!data) {
          vignette.appendChild(PL.el("span", { class: "champ__label" }, "image absente"));
          return;
        }
        vignette.insertBefore(
          PL.el("img", { src: data, alt: ref.legende || "Photo du constat" }),
          vignette.firstChild
        );
      });
      if (!o.lecture) {
        vignette.appendChild(PL.el("button", {
          type: "button", class: "photo-vignette__suppr",
          "aria-label": "Supprimer cette photo",
          onclick: function () {
            PL.photos.del(ref.id);
            o.liste.splice(o.liste.indexOf(ref), 1);
            o.onChange(o.liste);
            peindre();
          }
        }, "×"));
      }
      grille.appendChild(vignette);
    });
  }

  conteneur.appendChild(grille);

  if (!o.lecture) {
    var input = PL.el("input", {
      type: "file", accept: "image/*", capture: "environment", multiple: true
    });
    input.addEventListener("change", function () {
      var fichiers = Array.prototype.slice.call(input.files || []);
      input.value = "";
      if (!fichiers.length) return;
      PL.toast(fichiers.length > 1 ? "Traitement des photos…" : "Traitement de la photo…");
      fichiers.reduce(function (chaine, f) {
        return chaine.then(function () {
          return PL.photos.put(f).then(function (meta) {
            o.liste.push({ id: meta.id, legende: "" });
          });
        });
      }, Promise.resolve())
        .then(function () { o.onChange(o.liste); peindre(); PL.toast("Photo enregistrée."); })
        .catch(function (e) {
          PL.toast("Photo non enregistrée : " + (e && e.message ? e.message : "erreur"));
        });
    });
    var bouton = PL.el("button", {
      type: "button", class: "btn btn--petit",
      onclick: function () { input.click(); }
    }, "Ajouter une photo");
    conteneur.appendChild(PL.el("div", { class: "photo-ajout" }, input, bouton));
  }

  peindre();
  return conteneur;
};

/* --- utilitaires d'affichage ---------------------------------------- */

PL.formaterDate = function (iso) {
  if (!iso) return "—";
  var d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR") + " à " + d.toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit"
  });
};

PL.formaterOctets = function (o) {
  if (o < 1024) return o + " o";
  if (o < 1024 * 1024) return Math.round(o / 1024) + " Ko";
  return (o / (1024 * 1024)).toFixed(1) + " Mo";
};

PL.dateJour = function () {
  var d = new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
};

PL.dateFr = function (isoCourt) {
  if (!isoCourt) return "";
  var p = String(isoCourt).split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : isoCourt;
};
