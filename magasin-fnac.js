/* =====================================================================
   MAGASIN FNAC — LIEU DE JEU  (magasin-fnac.js)

   La mission ne se joue plus « à la Fnac Labège » et nulle part
   ailleurs : elle se joue dans LE MAGASIN QUE LE MATELOT A CHOISI.
   Tout le Palier 3 (disponibilité des ouvrages, génération des
   cartouches, historique) se règle sur ce magasin.

   CE QUE FAIT CE MODULE
     1. charger la liste des magasins (data/magasins-fnac.json, ou la
        version publiée dans Firestore si elle est plus récente) ;
     2. proposer le magasin LE PLUS PROCHE avec la géolocalisation de
        l'appareil — sur accord explicite, et sans jamais conserver les
        coordonnées GPS ;
     3. laisser le choix manuel (liste déroulante + recherche) : la
        géolocalisation est une AIDE, jamais une preuve de présence ;
     4. mémoriser le magasin confirmé (localStorage + fiche équipage).

   SÉCURITÉ DES DONNÉES VENUES DU WEB
   La liste est produite CÔTÉ SERVEUR par tools/sync-magasins-fnac.mjs
   (hebdomadaire, voir .github/workflows/sync-magasins-fnac.yml) : le
   téléphone du joueur n'interroge JAMAIS fnac.com. Ici, on ne fait que
   lire un fichier publié, et TOUT nom lu est nettoyé (nettoyerTexte)
   puis échappé (echapper) avant affichage : une donnée extérieure est
   considérée comme non fiable, même quand elle vient d'un site connu.

   VIE PRIVÉE
   Les coordonnées GPS servent uniquement à classer les magasins par
   distance. Elles ne sont ni écrites dans localStorage, ni envoyées à
   Firestore, ni transmises à quiconque : seul l'IDENTIFIANT du magasin
   confirmé est conservé.

   Utilisation :
     <script src="magasin-fnac.js?v=1"></script>
     NautilusMagasin.monterSelecteur(document.getElementById('hote'), {
       onConfirme: function (magasin) { … }
     });
     const courant = NautilusMagasin.courant();
   ===================================================================== */
(function () {
  'use strict';
  if (window.NautilusMagasin) return;

  var MOTEUR = window.NautilusArtefactMoteur || null;
  var URL_LISTE = 'data/magasins-fnac.json';
  var CLE_STOCKAGE = 'nautilusMagasin';
  var CLE_PUBLIEE = 'nautilusMagasinsPublies';   // copie Firestore (optionnelle)

  var _cache = null, _cacheAt = 0, _promesse = null;

  function nettoyer(s, max) {
    return MOTEUR ? MOTEUR.nettoyerTexte(s, max)
      : String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 120);
  }
  function echapper(s) {
    return MOTEUR ? MOTEUR.echapper(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
  }

  /* Normalise une fiche magasin quelle que soit sa source : aucune
     donnée brute du Web n'entre dans le DOM. */
  function normaliserMagasin(brut) {
    if (!brut || typeof brut !== 'object') return null;
    var id = nettoyer(brut.id, 32).replace(/[^A-Za-z0-9-]/g, '');
    var nom = nettoyer(brut.nom, 120);
    if (!id || !nom) return null;
    var m = {
      id: id,
      nom: nom,
      ville: nettoyer(brut.ville, 120),
      cp: nettoyer(brut.cp, 12).replace(/[^0-9]/g, ''),
      adresse: nettoyer(brut.adresse, 260),
      slug: nettoyer(brut.slug, 200).replace(/[^A-Za-z0-9/_-]/g, ''),
      actif: brut.actif !== false,
      precision: nettoyer(brut.precision, 20) || 'commune',
      note: nettoyer(brut.note, 200)
    };
    if (typeof brut.lat === 'number' && brut.lat >= -90 && brut.lat <= 90) m.lat = brut.lat;
    if (typeof brut.lon === 'number' && brut.lon >= -180 && brut.lon <= 180) m.lon = brut.lon;
    return m;
  }

  function normaliserListe(brut) {
    var liste = (brut && Array.isArray(brut.magasins) ? brut.magasins : (Array.isArray(brut) ? brut : []))
      .map(normaliserMagasin).filter(Boolean);
    return {
      version: nettoyer(brut && brut.version, 40) || 'inconnue',
      source: nettoyer(brut && brut.source, 300),
      syncedAt: nettoyer(brut && brut.syncedAt, 40),
      mode: nettoyer(brut && brut.mode, 40),
      count: liste.length,
      magasins: liste
    };
  }

  function lireFirestorePubliee() {
    /* Facultatif : si le panneau admin a publié une liste dans Firestore,
       elle a priorité quand elle est PLUS RÉCENTE que le fichier statique
       (publication atomique, jamais une liste partielle). */
    try {
      var brut = localStorage.getItem(CLE_PUBLIEE);
      if (!brut) return null;
      var doc = JSON.parse(brut);
      return doc && doc.magasins ? normaliserListe(doc) : null;
    } catch (e) { return null; }
  }

  function chargerListe(opts) {
    var o = opts || {};
    if (_cache && !o.forcer && Date.now() - _cacheAt < 5 * 60000) return Promise.resolve(_cache);
    if (_promesse && !o.forcer) return _promesse;
    _promesse = fetch(URL_LISTE + '?v=' + encodeURIComponent(_cache ? _cache.version : '1'), { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (brut) {
        var statique = normaliserListe(brut);
        var publiee = lireFirestorePubliee();
        var retenue = statique;
        if (publiee && publiee.count && Date.parse(publiee.syncedAt || 0) > Date.parse(statique.syncedAt || 0)) {
          retenue = publiee;
          retenue.mode = 'publiée-firestore';
        }
        _cache = retenue; _cacheAt = Date.now();
        return retenue;
      })
      .catch(function (e) {
        var publiee = lireFirestorePubliee();
        if (publiee && publiee.count) { _cache = publiee; _cacheAt = Date.now(); return _cache; }
        if (_cache) return _cache;                       // liste déjà en mémoire : on continue
        throw new Error('liste des magasins indisponible (' + (e && e.message ? e.message : 'réseau') + ')');
      })
      .then(function (r) { _promesse = null; return r; }, function (e) { _promesse = null; throw e; });
    return _promesse;
  }

  function utilisables(liste) {
    return MOTEUR ? MOTEUR.magasinsUtilisables(liste || (_cache && _cache.magasins) || [])
                  : (liste || []).filter(function (m) { return m && m.id && m.actif !== false; });
  }

  function rechercher(liste, texte) {
    var q = nettoyer(texte, 60).toLowerCase();
    if (!q) return utilisables(liste);
    return utilisables(liste).filter(function (m) {
      return (m.nom + ' ' + m.ville + ' ' + m.cp).toLowerCase().indexOf(q) >= 0;
    });
  }

  function urlFiche(m) {
    if (!m || !m.slug || !m.id) return '';
    return 'https://www.fnac.com/' + m.slug.split('/').map(encodeURIComponent).join('/')
      + '/' + encodeURIComponent(m.id) + '/w-4';
  }

  function libelle(m) {
    if (!m) return '';
    return 'Fnac ' + m.nom + (m.ville && m.ville.toLowerCase() !== m.nom.toLowerCase()
      ? ' (' + m.ville + ')' : '');
  }

  /* helper test mode : zzzz-0000 / ZZZZ-0000 ne déclenche jamais la géoloc */
  function estModeTest() {
    try {
      var c = (localStorage.getItem('nautilusMatelotCode') || '').toUpperCase().trim();
      if (c === 'ZZZZ-0000') return true;
      if (/[?&]m=zzzz-0000(?:&|$)/i.test(location.search)) return true;
      if (/[?&]m=ZZZZ-0000(?:&|$)/i.test(location.search)) return true;
      if (/[?&]apercu=jeu/i.test(location.search)) return true;
      if (window.Nautilus && window.Nautilus.isTestMode && window.Nautilus.isTestMode()) return true;
      if (window.NautilusBlocages && window.NautilusBlocages.CODE_TEST && c === window.NautilusBlocages.CODE_TEST) return true;
    } catch (e) {}
    return false;
  }

  /* --- géolocalisation : une aide, jamais une preuve ---------------- */
  function geolocaliser(opts) {
    if (estModeTest()) return Promise.resolve({ erreur: 'desactivee-test', desactiveeTest: true });
    var o = opts || {};
    return new Promise(function (resolve) {
      if (!navigator.geolocation) { resolve({ erreur: 'indisponible' }); return; }
      var fini = false;
      var timer = setTimeout(function () {
        if (!fini) { fini = true; resolve({ erreur: 'delai' }); }
      }, Number(o.delaiMs) || 12000);
      try {
        navigator.geolocation.getCurrentPosition(function (pos) {
          if (fini) return; fini = true; clearTimeout(timer);
          /* Les coordonnées ne quittent PAS cette fonction : elles ne
             sont ni stockées, ni envoyées. */
          resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude,
                    precision: Math.round(pos.coords.accuracy || 0) });
        }, function (err) {
          if (fini) return; fini = true; clearTimeout(timer);
          resolve({ erreur: err && err.code === 1 ? 'refus' : 'indisponible' });
        }, { enableHighAccuracy: false, timeout: Number(o.delaiMs) || 12000, maximumAge: 300000 });
      } catch (e) {
        if (!fini) { fini = true; clearTimeout(timer); resolve({ erreur: 'indisponible' }); }
      }
    });
  }

  function suggerer(opts) {
    if (estModeTest()) return Promise.resolve({ suggestions: [], erreur: 'desactivee-test', desactiveeTest: true });
    var o = opts || {};
    return Promise.all([chargerListe().catch(function () { return null; }), geolocaliser(o)])
      .then(function (r) {
        var liste = r[0], pos = r[1];
        if (!liste) return { suggestions: [], erreur: 'liste-indisponible' };
        if (!pos || pos.erreur) return { suggestions: [], erreur: (pos && pos.erreur) || 'indisponible' };
        var proches = MOTEUR ? MOTEUR.plusProche(pos.lat, pos.lon, liste.magasins, Number(o.nombre) || 3) : [];
        return { suggestions: proches, position: { precision: pos.precision } };
      });
  }

  /* --- mémorisation du magasin CONFIRMÉ ---------------------------- */
  function courant() {
    try {
      var brut = localStorage.getItem(CLE_STOCKAGE);
      if (!brut) return null;
      var m = JSON.parse(brut);
      return m && m.id ? m : null;
    } catch (e) { return null; }
  }

  /* Retrouver un magasin par son identifiant (chargement paresseux de la
     liste). Renvoie {magasin} ou {magasin:null} : un id inconnu ne doit
     jamais casser la page qui l'affiche. */
  function trouver(id) {
    if (!id) return Promise.resolve({ magasin: null });
    return chargerListe().then(function (liste) {
      var m = MOTEUR ? MOTEUR.trouverMagasin(liste.magasins, String(id)) : null;
      return { magasin: m || null };
    }).catch(function () { return { magasin: null }; });
  }

  function memoriser(magasin, source) {
    if (!magasin || !magasin.id) return null;
    var fiche = {
      id: magasin.id, nom: nettoyer(magasin.nom, 120), ville: nettoyer(magasin.ville, 120),
      cp: nettoyer(magasin.cp, 12), source: source || 'manuel', choisiLe: new Date().toISOString(),
      versionListe: (_cache && _cache.version) || 'inconnue'
    };
    /* AUCUNE coordonnée GPS n'est conservée : seulement le magasin — c'est la géoloc site-wide. */
    try {
      localStorage.setItem(CLE_STOCKAGE, JSON.stringify(fiche));
      // Diffuse à tout le site (autres onglets / futurs paliers)
      try { window.dispatchEvent(new CustomEvent('nautilus:magasin-change', {detail: fiche})); } catch(_){}
      try { localStorage.setItem('nautilusMagasinId', fiche.id); } catch(_){}
    } catch (e) {}
    return fiche;
  }

  function effacer() { try { localStorage.removeItem(CLE_STOCKAGE); } catch (e) {} }

  /* --- sélecteur : la première page de démarrage ------------------- */
  function monterSelecteur(hote, opts) {
    var o = opts || {};
    if (!hote) return null;
    var onConfirme = o.onConfirme || function () {};
    var titre = o.titre || '📍 Ton magasin Fnac';
    var intro = o.intro || 'Sélectionne le magasin Fnac dans lequel tu participes à la mission. '
      + 'Les ouvrages proposés et les indices du Nautilus dépendent de ce magasin.';
    var choix = courant();

    hote.innerHTML =
      '<div class="magasin-selec">'
      + '<div class="magasin-titre">' + echapper(titre) + '</div>'
      + '<p class="magasin-intro">' + echapper(intro) + '</p>'
      + '<div class="magasin-ligne">'
      +   '<label for="magasinRecherche">Rechercher une ville ou un magasin</label>'
      +   '<input id="magasinRecherche" type="search" placeholder="Ex. Labège, Toulouse, 31670…" autocomplete="off">'
      + '</div>'
      + '<div class="magasin-ligne">'
      +   '<label for="magasinListe">Magasin</label>'
      +   '<select id="magasinListe"><option value="">Chargement de la liste…</option></select>'
      + '</div>'
      + '<div class="magasin-actions">'
      +   '<button type="button" class="magasin-btn magasin-btn--geo" id="magasinGeo">🛰️ Utiliser ma position</button>'
      +   '<button type="button" class="magasin-btn magasin-btn--ok" id="magasinOk">✔️ Confirmer ce magasin</button>'
      + '</div>'
      + '<div class="magasin-msg" id="magasinMsg" role="status" aria-live="polite"></div>'
      + '<p class="magasin-rgpd">Ta position sert uniquement à proposer le magasin le plus proche. '
      + 'Elle n’est ni enregistrée, ni transmise : seul le magasin que tu confirmes est conservé.</p>'
      + '</div>';

    var sel = hote.querySelector('#magasinListe');
    var rech = hote.querySelector('#magasinRecherche');
    var msg = hote.querySelector('#magasinMsg');
    var btnGeo = hote.querySelector('#magasinGeo');
    var btnOk = hote.querySelector('#magasinOk');
    var liste = [];

    function dire(html, kind) {
      msg.innerHTML = html;
      msg.className = 'magasin-msg' + (kind ? ' is-' + kind : '');
    }

    function triAlpha(a,b){
      var na=(a.nom||'').toLowerCase(), nb=(b.nom||'').toLowerCase();
      if(na<nb) return -1; if(na>nb) return 1;
      var va=(a.ville||'').toLowerCase(), vb=(b.ville||'').toLowerCase();
      if(va<vb) return -1; if(va>vb) return 1;
      return (a.cp||'').localeCompare(b.cp||'');
    }
    function remplir(magasins, garder, plusProcheId) {
      var options = ['<option value="">— Choisir un magasin —</option>'];
      if(plusProcheId){
        var proche = magasins.filter(function(m){return m.id===plusProcheId;})[0];
        if(proche){
          options.push('<option value="' + echapper(proche.id) + '" selected>📍 Le plus proche — Fnac ' + echapper(proche.nom) + (proche.ville ? ' — ' + proche.ville : '') + '</option>');
          options.push('<option disabled>─────────────</option>');
        }
      }
      magasins.forEach(function (m) {
        // Évite doublon si déjà mis en "plus proche"
        if(plusProcheId && m.id===plusProcheId) return;
        options.push('<option value="' + echapper(m.id) + '"'
          + (garder && garder === m.id && !plusProcheId ? ' selected' : '') + '>'
          + echapper('Fnac ' + m.nom + (m.ville ? ' — ' + m.ville : '') + (m.cp ? ' (' + m.cp + ')' : ''))
          + '</option>');
      });
      sel.innerHTML = options.join('');
    }

    function appliquerSuggestion(suggestions) {
      if (!suggestions.length) return;
      var lignes = suggestions.map(function (s, i) {
        return '<button type="button" class="magasin-suggest" data-id="' + echapper(s.magasin.id) + '">'
          + (i === 0 ? '🎯 ' : '') + echapper('Fnac ' + s.magasin.nom)
          + '<span>' + echapper(String(s.distanceKm) + ' km') + '</span></button>';
      }).join('');
      dire('<b>Magasin le plus proche détecté.</b><div class="magasin-suggests">' + lignes + '</div>'
        + '<span class="magasin-ou">Confirme-le, ou choisis-en un autre dans la liste.</span>', 'geo');
      Array.prototype.forEach.call(msg.querySelectorAll('.magasin-suggest'), function (b) {
        b.addEventListener('click', function () {
          sel.value = b.dataset.id;
          dire('Magasin sélectionné : <b>' + echapper(sel.options[sel.selectedIndex].textContent) + '</b>. '
            + 'Confirme pour commencer.', 'ok');
        });
      });
    }

    rech.addEventListener('input', function () {
      var filtres = rechercher(liste, rech.value).slice().sort(triAlpha);
      remplir(filtres, choix && choix.id);
    });

    btnGeo.addEventListener('click', function () {
      btnGeo.disabled = true;
      dire('🛰️ Recherche de ta position…', '');
      suggerer({ nombre: 3 }).then(function (r) {
        btnGeo.disabled = false;
        if (r.erreur === 'refus') {
          dire('Nous ne pouvons pas déterminer ta position (autorisation refusée). '
            + 'Sélectionne ton magasin Fnac dans la liste pour poursuivre.', 'warn');
          return;
        }
        if (r.erreur || !r.suggestions.length) {
          dire('Position indisponible ou aucun magasin proche : sélectionne ton magasin dans la liste.', 'warn');
          return;
        }
        appliquerSuggestion(r.suggestions);
      });
    });

    btnOk.addEventListener('click', function () {
      var id = sel.value;
      if (!id) { dire('Choisis d’abord un magasin dans la liste.', 'warn'); return; }
      var m = null;
      for (var i = 0; i < liste.length; i++) if (liste[i].id === id) m = liste[i];
      if (!m) { dire('Magasin introuvable dans la liste : recharge la page.', 'warn'); return; }
      var fiche = memoriser(m, 'manuel');
      dire('✔️ Magasin confirmé : <b>' + echapper(libelle(m)) + '</b>. '
        + 'Les ouvrages du Nautilus seront cherchés dans ce magasin.', 'ok');
      onConfirme(fiche, m);
    });

    chargerListe().then(function (r) {
      liste = r.magasins || [];
      var utilisablesListe = utilisables(liste).slice().sort(triAlpha);
      // Si un magasin déjà mémorisé site-wide, on l'affiche et on ne re-géolocalise pas
      if (choix) {
        remplir(utilisablesListe, choix.id);
        dire('Magasin de la mission : <b>' + echapper(choix.nom) + ' — ' + echapper(choix.ville||'') + '</b> (mémorisé pour tout le site). <a href="#" id="magasinChanger" style="color:var(--fnac)">Changer ?</a>', 'ok');
        var ch = hote.querySelector('#magasinChanger');
        if(ch) ch.addEventListener('click', function(e){ e.preventDefault(); choix=null; try{localStorage.removeItem(CLE_STOCKAGE);}catch(_){ } remplir(utilisablesListe, null); dire('Choisis ton magasin Fnac dans la liste ci-dessous.', ''); });
        // Bouton Confirmer devient "Continuer"
        btnOk.textContent = '✔️ Continuer avec ce magasin';
        if (o.pret) o.pret(utilisablesListe);
        return;
      }
      // Pas de choix : on tente la géoloc en 1 fois, sinon alphabétique
      remplir(utilisablesListe, null);
      dire('Liste officielle Fnac chargée : <b>' + utilisablesListe.length + ' magasins</b> par ordre alphabétique'
        + ' (version ' + echapper(r.version) + (r.syncedAt ? ', vérifiée le '
          + echapper(new Date(r.syncedAt).toLocaleString('fr-FR')) : '') + ').<br>Si ton appareil le permet, ton magasin le plus proche sera indiqué en tête de liste.', '');
      if (o.suggereGeo !== false) {
        suggerer({ nombre: 1, delaiMs: 7000 }).then(function (s) {
          if (s && s.suggestions && s.suggestions.length) {
            var procheId = s.suggestions[0].magasin.id;
            var dist = s.suggestions[0].distanceKm;
            remplir(utilisablesListe, null, procheId);
            dire('📍 <b>Magasin le plus proche détecté : ' + echapper(libelle(s.suggestions[0].magasin)) + ' — ' + dist + ' km</b><br>Il est pré-sélectionné. Confirme ou choisis un autre dans la liste.', 'geo');
          }
        });
      }
      if (o.pret) o.pret(utilisablesListe);
    }).catch(function (e) {
      sel.innerHTML = '<option value="">Liste indisponible</option>';
      dire('⚠️ La liste des magasins n’a pas pu être chargée (' + echapper(String(e && e.message || e)) + '). '
        + 'Vérifie la connexion, puis recharge la page.', 'danger');
    });

    return {
      recharger: function () { return chargerListe({ forcer: true }); },
      valeur: function () { return sel.value; }
    };
  }

  window.NautilusMagasin = {
    URL_LISTE: URL_LISTE,
    CLE_STOCKAGE: CLE_STOCKAGE,
    CLE_PUBLIEE: CLE_PUBLIEE,
    chargerListe: chargerListe,
    normaliserListe: normaliserListe,
    normaliserMagasin: normaliserMagasin,
    utilisables: utilisables,
    rechercher: rechercher,
    urlFiche: urlFiche,
    libelle: libelle,
    geolocaliser: geolocaliser,
    suggerer: suggerer,
    courant: courant,
    trouver: trouver,
    memoriser: memoriser,
    effacer: effacer,
    monterSelecteur: monterSelecteur
  };
})();
