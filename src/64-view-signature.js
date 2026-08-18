/* ------------------------------------------------------------------
   Observations, contrôle de complétion, signatures tactiles et
   verrouillage de la campagne.
   ------------------------------------------------------------------ */

PL.manques = function (dossier, mode) {
  var liste = [];
  var camp = dossier.campagnes[mode];
  var champEtat = mode === "sortie" ? "etatSortie" : "etatEntree";

  if (!dossier.logement.adresse.trim()) liste.push("Adresse du logement");
  if (!dossier.bailleur.nom.trim()) liste.push("Nom du bailleur");
  if (!dossier.locataire.nom.trim()) liste.push("Nom du locataire");
  if (!camp.date) liste.push("Date du constat");
  if (!camp.lieu.trim()) liste.push("Lieu (« fait à »)");

  var cptVides = PL.DEFAULTS.compteurs.filter(function (m) {
    return !String(dossier.edl.compteurs[mode][m.cle].valeur).trim();
  });
  if (cptVides.length) {
    liste.push("Compteurs non relevés : " + cptVides.map(function (m) {
      return m.libelle;
    }).join(", "));
  }

  dossier.edl.pieces.forEach(function (p) {
    var vides = PL.SUPPORTS.filter(function (s) { return !p.supports[s.cle][champEtat]; });
    if (vides.length) {
      liste.push(p.nom + " : " + vides.map(function (s) {
        return s.libelle.toLowerCase();
      }).join(", ") + " sans état");
    }
  });

  dossier.mobilier.sections.forEach(function (sec) {
    var n = sec.lignes.filter(function (l) { return !l.absent && !l[champEtat]; }).length;
    if (n) liste.push(sec.titre + " : " + n + " ligne" + (n > 1 ? "s" : "") + " sans état");
  });

  return liste;
};

PL.zoneSignature = function (o) {
  /* o : { valeur, onChange, lecture, titre } */
  var canvas = PL.el("canvas", { class: "signature-zone", "aria-label": "Zone de signature — " + o.titre });
  var ctx = null;
  var dessine = false;
  var vierge = true;

  function dimensionner() {
    var dpr = window.devicePixelRatio || 1;
    var largeur = canvas.clientWidth || 420;
    var hauteur = 170;
    canvas.width = Math.round(largeur * dpr);
    canvas.height = Math.round(hauteur * dpr);
    ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largeur, hauteur);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
    if (o.valeur) {
      var img = new Image();
      img.onload = function () { ctx.drawImage(img, 0, 0, largeur, hauteur); };
      img.src = o.valeur;
      vierge = false;
    }
  }

  function position(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  if (!o.lecture) {
    canvas.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      dessine = true;
      vierge = false;
      var p = position(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!dessine) return;
      var p = position(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (evt) {
      canvas.addEventListener(evt, function () {
        if (!dessine) return;
        dessine = false;
        o.onChange(canvas.toDataURL("image/png"));
      });
    });
  }

  setTimeout(dimensionner, 0);

  var bloc = PL.el("div", null,
    PL.el("span", { class: "champ__label" }, o.titre),
    canvas,
    PL.el("div", { class: "signature-legende" },
      PL.el("span", null, "« Lu et approuvé »"),
      o.lecture ? null : PL.el("button", {
        type: "button", class: "btn btn--petit",
        onclick: function () {
          dimensionner();
          var l = canvas.clientWidth || 420;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, l, 170);
          ctx.strokeStyle = "#111111";
          vierge = true;
          o.onChange("");
        }
      }, "Effacer")
    )
  );
  bloc.estVierge = function () { return vierge; };
  return bloc;
};

PL.vues.signatures = function (dossier, mode) {
  var section = PL.SECTIONS[6];
  var camp = dossier.campagnes[mode];
  var verrou = PL.estVerrouille(dossier, mode);
  var racine = PL.el("div", null, PL.enteteDossier(dossier, mode, section));

  racine.appendChild(PL.el("section", { class: "carte" },
    PL.el("div", { class: "carte__entete" },
      PL.el("h2", null, "Observations et réserves")),
    PL.champ({
      label: "Observations du constat " + PL.deMode(mode),
      valeur: dossier.observations[mode], multiligne: true, rows: 5, lecture: verrou,
      onChange: function (v) { PL.maj(dossier, function (d) { d.observations[mode] = v; }); }
    })
  ));

  /* --- contrôle de complétion : informe, ne bloque pas --- */
  var manques = PL.manques(dossier, mode);
  var carteControle = PL.el("section", { class: "carte" },
    PL.el("div", { class: "carte__entete" },
      PL.el("h2", null, "Contrôle avant signature"),
      PL.el("span", { class: "dossier-ligne__meta" },
        PL.progression(dossier, mode).global.pourcent + " % renseigné")
    )
  );
  if (manques.length) {
    carteControle.appendChild(PL.el("div", { class: "note" },
      manques.length + " point" + (manques.length > 1 ? "s" : "") +
      " non renseigné" + (manques.length > 1 ? "s" : "") +
      ". Vous pouvez signer malgré tout : un élément laissé vide sera imprimé vide."));
    var ul = PL.el("ul", { class: "liste-manques" });
    manques.slice(0, 20).forEach(function (m) { ul.appendChild(PL.el("li", null, m)); });
    if (manques.length > 20) {
      ul.appendChild(PL.el("li", null, "… et " + (manques.length - 20) + " autres."));
    }
    carteControle.appendChild(ul);
  } else {
    carteControle.appendChild(PL.el("p", null, "Tous les postes du constat sont renseignés."));
  }
  racine.appendChild(carteControle);

  /* --- délais légaux --- */
  racine.appendChild(PL.el("section", { class: "carte carte--sourde" },
    PL.el("h2", { style: "margin-bottom:8px" }, "Délais de réserve à rappeler au locataire"),
    PL.el("p", null,
      "Le locataire peut demander la modification de l'état des lieux d'entrée dans les " +
      "dix jours suivant son établissement."),
    PL.el("p", { style: "margin-bottom:0" },
      "Pour les éléments de chauffage, cette demande reste possible pendant le premier mois " +
      "de la période de chauffe.")
  ));

  /* --- signatures --- */
  var carteSign = PL.el("section", { class: "carte" },
    PL.el("div", { class: "carte__entete" },
      PL.el("h2", null, "Signatures"),
      camp.signeLe
        ? PL.el("span", { class: "badge badge--signe" }, "Signé le " + PL.formaterDate(camp.signeLe))
        : null
    ),
    PL.el("div", { class: "grille-champs" },
      PL.champ({
        label: "Nom du bailleur (ou de son mandataire)", valeur: camp.nomBailleur,
        lecture: verrou,
        onChange: function (v) { PL.maj(dossier, function () { camp.nomBailleur = v; }); }
      }),
      PL.champ({
        label: "Nom du locataire", valeur: camp.nomLocataire, lecture: verrou,
        onChange: function (v) { PL.maj(dossier, function () { camp.nomLocataire = v; }); }
      })
    ),
    PL.el("div", { class: "signature-bloc" },
      PL.zoneSignature({
        titre: "Signature du bailleur", valeur: camp.signatureBailleur, lecture: verrou,
        onChange: function (v) { PL.maj(dossier, function () { camp.signatureBailleur = v; }); }
      }),
      PL.zoneSignature({
        titre: "Signature du locataire", valeur: camp.signatureLocataire, lecture: verrou,
        onChange: function (v) { PL.maj(dossier, function () { camp.signatureLocataire = v; }); }
      })
    ),
    PL.el("div", { class: "note" },
      "La signature tactile recueillie ici vaut commencement de preuve écrite. " +
      "Elle ne constitue pas une signature électronique qualifiée au sens du règlement eIDAS. " +
      "Pour un constat contradictoire, imprimez et faites signer les exemplaires papier.")
  );

  var actions = PL.el("div", { class: "barre-actions" });
  if (verrou) {
    actions.appendChild(PL.el("button", {
      type: "button", class: "btn",
      onclick: function () {
        PL.confirmer({
          titre: "Rouvrir le constat ?",
          message: "Le constat redeviendra modifiable. La date de signature sera effacée " +
            "et devra être reprise après correction.",
          valider: "Rouvrir"
        }).then(function (ok) {
          if (!ok) return;
          PL.maj(dossier, function () { camp.verrouille = false; camp.signeLe = null; });
          PL.toast("Constat rouvert.");
          PL.router.rafraichir();
        });
      }
    }, "Rouvrir le constat"));
  } else {
    actions.appendChild(PL.el("button", {
      type: "button", class: "btn btn--principal",
      onclick: function () {
        var message = manques.length
          ? manques.length + " point(s) restent non renseignés. Le constat sera verrouillé " +
            "en l'état et passera en lecture seule."
          : "Le constat sera verrouillé et passera en lecture seule. " +
            "Vous pourrez le rouvrir explicitement si nécessaire.";
        PL.confirmer({
          titre: "Signer et verrouiller le constat " + PL.deMode(mode) + " ?",
          message: message, valider: "Signer et verrouiller"
        }).then(function (ok) {
          if (!ok) return;
          PL.maj(dossier, function () {
            camp.verrouille = true;
            camp.signeLe = new Date().toISOString();
          });
          PL.toast("Constat signé et verrouillé.");
          PL.router.rafraichir();
        });
      }
    }, "Signer et verrouiller"));
  }
  actions.appendChild(PL.el("button", {
    type: "button", class: "btn",
    onclick: function () { PL.router.go("/d/" + dossier.id + "/" + mode); }
  }, "Retour au sommaire"));

  carteSign.appendChild(actions);
  racine.appendChild(carteSign);
  return racine;
};
