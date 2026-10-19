/* =====================================================================
   admin-artefact.js — ONGLET ADMIN « 📖 Artefact » du Palier 3

   Ce module s'INJECTE dans le panneau admin existant (admin-button.js
   sur les pages palier, copie en ligne dans index.html) sans modifier
   son HTML dupliqué : il attend #adminWorkspace, ajoute un onglet
   data-tab="artefact" et son volet data-pane="artefact", puis se
   branche sur le même mécanisme d'onglets.

   ---------------------------------------------------------------------
   LE CODE D'ACCÈS ADMIN N'EST PAS UN SECRET
   ---------------------------------------------------------------------
   Le code qui ouvre le panneau est présent dans le bundle public
   (admin-button.js). Il ne protège donc rien de sensible. Ce qui protège
   le catalogue (titres, EAN, SKU) et les réponses des épreuves, c'est la
   PHRASE D'ADMINISTRATION saisie ici :
     · elle sert de clé à PBKDF2-SHA256 (200 000 itérations) puis AES-GCM ;
     · elle n'est écrite NULLE PART (ni localStorage, ni Firestore, ni
       l'URL) et disparaît au rechargement de la page ;
     · sans elle, le panneau affiche des cartouches et des sessions, mais
       jamais un titre, jamais un EAN, jamais une réponse.

   ---------------------------------------------------------------------
   CE QUE L'ORGANISATEUR FAIT ICI
   ---------------------------------------------------------------------
   1. Choisir le MAGASIN de référence (liste synchronisée depuis fnac.com).
   2. CONFIRMER la disponibilité « retrait sous 1 h » de ce magasin
      (vérification faite à la main sur fnac.com : aucun appel réseau
      depuis le navigateur, aucun contournement d'anti-bot).
   3. Saisir / importer le CATALOGUE des ouvrages compatibles.
   4. GÉNÉRER les pistes anonymisées (cartouches) du magasin.
   5. Suivre les SESSIONS : étape, erreurs, indices demandés, ouvrages
      introuvables — et RESÉLECTIONNER un ouvrage en un clic.

   Tout ce qui est écrit ici passe par artefact-service.js : ce fichier
   ne contient aucune règle de jeu et aucune donnée d'ouvrage.
   ===================================================================== */
(function () {
  'use strict';
  if (window.NautilusAdminArtefact) return;

  var ONGLET = 'artefact';
  var CLE_MAGASIN_ADMIN = 'nautilusAdminMagasin';

  var _phrase = '';            /* mémoire volatile uniquement */
  var _monte = false;
  var _magasinId = '';
  var _liste = null;           /* liste des magasins chargée */
  var _catalogue = null;       /* copie de travail déchiffrée */
  var _charge = false;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>\"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c];
    });
  }
  function M() { return window.NautilusArtefactMoteur; }
  function S() { return window.NautilusArtefact; }
  function MG() { return window.NautilusMagasin; }

  function dire(id, texte, kind) {
    var el = $(id);
    if (!el) return;
    el.innerHTML = texte;
    el.className = 'adm-af-msg ' + (kind || '');
    el.style.color = kind === 'ok' ? '#075c39' : kind === 'danger' ? '#9b1111' : kind === 'warn' ? '#8a5b00' : '';
  }
  function date(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('fr-FR'); } catch (e) { return String(iso); }
  }
  function age(iso) {
    if (!iso) return '—';
    var min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (!isFinite(min)) return '—';
    if (min < 1) return 'à l’instant';
    if (min < 60) return 'il y a ' + min + ' min';
    if (min < 1440) return 'il y a ' + Math.round(min / 60) + ' h';
    return 'il y a ' + Math.round(min / 1440) + ' j';
  }

  /* ==================================================================
     1. INJECTION DE L'ONGLET
     ================================================================== */
  function HTML_PANE() {
    return ''
    + '<p class="small" style="margin-bottom:10px">Palier 3 — <b>l’artefact du Nautilus</b> : le magasin de référence, '
    + 'la disponibilité confirmée, le catalogue chiffré, les pistes anonymisées et les sessions des équipages.</p>'

    /* --- phrase d'administration --- */
    + '<div class="adm-af-sec">'
    +   '<h4>🔑 Phrase d’administration</h4>'
    +   '<div class="adm-af-ligne">'
    +     '<input id="afAdmPhrase" class="adm-af-input" type="password" autocomplete="off" '
    +       'placeholder="Phrase de déchiffrement du catalogue">'
    +     '<button id="afAdmOuvrir" class="primary" type="button">🔓 Ouvrir le coffre</button>'
    +     '<button id="afAdmFermer" class="secondary" type="button">🔒 Verrouiller</button>'
    +   '</div>'
    +   '<p class="adm-af-note" id="afAdmPhraseEtat">Coffre verrouillé : aucun titre, aucun EAN, aucune réponse ne s’affiche.</p>'
    +   '<p class="adm-af-note">⚠️ Le code d’ouverture du panneau admin est présent dans le code public du site : il ne '
    +   'protège rien. La <b>phrase</b> ci-dessus est la seule clé du catalogue (AES-GCM, PBKDF2 200 000 itérations). '
    +   'Elle n’est enregistrée nulle part et s’efface en fermant la page.</p>'
    + '</div>'

    /* --- magasin de référence --- */
    + '<div class="adm-af-sec">'
    +   '<h4>📍 Magasin de référence</h4>'
    +   '<div class="adm-af-ligne">'
    +     '<select id="afAdmMagasin" class="adm-af-select"><option value="">— Choisir un magasin —</option></select>'
    +     '<button id="afAdmMagasinReload" class="secondary" type="button">↻ Recharger la liste</button>'
    +   '</div>'
    +   '<p class="adm-af-note" id="afAdmListeEtat">Liste non chargée.</p>'
    +   '<div class="adm-af-ligne">'
    +     '<button id="afAdmVerifierListe" class="secondary" type="button">🧪 Contrôler la liste</button>'
    +     '<button id="afAdmPublierListe" class="primary" type="button">📤 Publier la liste (Firestore)</button>'
    +     '<span class="small" id="afAdmListePubliee"></span>'
    +   '</div>'
    +   '<p class="adm-af-note" id="afAdmListeMsg"></p>'
    + '</div>'

    /* --- disponibilité --- */
    + '<div class="adm-af-sec">'
    +   '<h4>⏱️ Disponibilité confirmée (retrait sous 1 h)</h4>'
    +   '<p class="adm-af-note">Vérifie <b>à la main</b> sur fnac.com que les ouvrages du catalogue sont bien '
    +   '« retrait sous 1 h » dans ce magasin, puis confirme ici. La confirmation n’est valable que '
    +   '<b>15 minutes au lancement</b> d’une mission : c’est la seule fenêtre de fraîcheur du jeu, elle ne '
    +   'chronomètre jamais un matelot.</p>'
    +   '<div class="adm-af-ligne">'
    +     '<input id="afAdmDelai" class="adm-af-input" type="text" value="Retrait gratuit sous 1H">'
    +     '<button id="afAdmReconfirmer" class="primary" type="button">✅ Reconfirmer toutes les pistes du magasin</button>'
    +   '</div>'
    +   '<p class="adm-af-note" id="afAdmDispoMsg"></p>'
    + '</div>'

    /* --- catalogue --- */
    + '<div class="adm-af-sec">'
    +   '<h4>📚 Catalogue des ouvrages</h4>'
    +   '<p class="adm-af-note">Le catalogue est <b>chiffré</b> avant d’être écrit : ni ce dépôt, ni Firestore, ni le '
    +   'réseau ne contiennent un titre ou un EAN en clair. Ajoute les ouvrages un par un, ou importe un JSON '
    +   '(structure : <code>data/catalogue-artefacts.example.json</code>).</p>'
    +   '<div class="adm-af-ligne">'
    +     '<button id="afAdmCatCharger" class="secondary" type="button">↻ Lire le catalogue</button>'
    +     '<button id="afAdmCatExporter" class="secondary" type="button">⬇️ Exporter (JSON local)</button>'
    +     '<label class="secondary" style="cursor:pointer;padding:8px 10px;border:1px solid #cfd8e3;border-radius:8px">'
    +       '📥 Importer un JSON<input id="afAdmCatFichier" type="file" accept="application/json" hidden></label>'
    +     '<button id="afAdmCatPublier" class="primary" type="button">🔐 Publier le catalogue chiffré</button>'
    +   '</div>'
    +   '<p class="adm-af-note" id="afAdmCatEtat">Catalogue non lu.</p>'
    +   '<div id="afAdmCatTable"></div>'
    +   '<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700">➕ Ajouter un ouvrage</summary>'
    +     '<div class="adm-af-ligne" style="margin-top:8px">'
    +       '<input id="afCatTitre" class="adm-af-input" placeholder="Titre (tel qu’imprimé sur la couverture)">'
    +       '<input id="afCatAuteur" class="adm-af-input" placeholder="Auteur (ou Collectif)">'
    +       '<select id="afCatAuteurType" class="adm-af-select"><option value="unique">une personne</option>'
    +         '<option value="collectif">collectif</option></select>'
    +     '</div>'
    +     '<div class="adm-af-ligne">'
    +       '<input id="afCatEditeur" class="adm-af-input" placeholder="Éditeur">'
    +       '<input id="afCatEdition" class="adm-af-input" placeholder="Mention d’édition (ex. 7e édition)">'
    +       '<input id="afCatEditionNumero" class="adm-af-input" type="number" min="0" placeholder="N° d’édition">'
    +       '<input id="afCatAnnee" class="adm-af-input" type="number" placeholder="Année">'
    +     '</div>'
    +     '<div class="adm-af-ligne">'
    +       '<input id="afCatEan" class="adm-af-input" placeholder="EAN (13 chiffres)">'
    +       '<input id="afCatSku" class="adm-af-input" placeholder="SKU Fnac">'
    +       '<input id="afCatCategorie" class="adm-af-input" placeholder="Libellé déroulant Fnac (ex. Atlas / carte)">'
    +     '</div>'
    +     '<div class="adm-af-ligne">'
    +       '<input id="afCatRayon" class="adm-af-input" placeholder="Rayon (ex. Géographie)">'
    +       '<select id="afCatType" class="adm-af-select"></select>'
    +       '<select id="afCatVendeur" class="adm-af-select"><option value="fnac">vendu par Fnac</option>'
    +         '<option value="partenaire">vendu par un partenaire</option></select>'
    +       '<button id="afCatAjouter" class="primary" type="button">➕ Ajouter au catalogue</button>'
    +     '</div>'
    +     '<p class="adm-af-note" id="afAdmCatMsg"></p>'
    +   '</details>'
    + '</div>'

    /* --- pistes (cartouches) --- */
    + '<div class="adm-af-sec">'
    +   '<h4>🎯 Pistes anonymisées (cartouches)</h4>'
    +   '<p class="adm-af-note">Une piste = un ouvrage disponible + une énigme complète, <b>sans aucune donnée '
    +   'lisible</b>. Le jeu en choisit une au lancement de chaque Palier 3. Régénérer après chaque confirmation '
    +   'de disponibilité.</p>'
    +   '<div class="adm-af-ligne">'
    +     '<button id="afAdmGenerer" class="primary" type="button">⚙️ Générer les pistes du magasin</button>'
    +     '<button id="afAdmCartouchesReload" class="secondary" type="button">↻ Recharger</button>'
    +     '<span class="small" id="afAdmCartouchesEtat"></span>'
    +   '</div>'
    +   '<div id="afAdmCartouchesTable"></div>'
    +   '<p class="adm-af-note" id="afAdmCartouchesMsg"></p>'
    + '</div>'

    /* --- sessions --- */
    + '<div class="adm-af-sec">'
    +   '<h4>🚢 Sessions des équipages</h4>'
    +   '<p class="adm-af-note">Suivi en direct : étape, réponses refusées, indices demandés, ouvrages introuvables. '
    +   '<b>Resélectionner le livre</b> affecte une autre piste sans compter d’erreur et conserve la progression '
    +   'compatible.</p>'
    +   '<div class="adm-af-ligne">'
    +     '<button id="afAdmSessionsReload" class="secondary" type="button">↻ Recharger les sessions</button>'
    +     '<span class="small" id="afAdmSessionsEtat"></span>'
    +   '</div>'
    +   '<p class="adm-af-note" id="afAdmSessionsMsg"></p>'
    +   '<div id="afAdmSessionsTable"></div>'
    + '</div>'

    /* --- configuration --- */
    + '<div class="adm-af-sec">'
    +   '<h4>⚙️ Configuration du service</h4>'
    +   '<div class="adm-af-ligne">'
    +     '<select id="afAdmMode" class="adm-af-select">'
    +       '<option value="operateur">operateur — disponibilité confirmée à la main (hébergement statique)</option>'
    +       '<option value="fonction">fonction — vérification par une Cloud Function HTTPS</option>'
    +     '</select>'
    +     '<input id="afAdmEndpoint" class="adm-af-input" placeholder="https://…/selectionner (mode fonction)">'
    +     '<input id="afAdmFenetre" class="adm-af-input" type="number" min="1" max="1440" placeholder="Fenêtre (min)" style="max-width:130px">'
    +   '</div>'
    +   '<div class="adm-af-ligne">'
    +     '<select id="afAdmMagasinDefaut" class="adm-af-select"><option value="">— Magasin par défaut (aucun) —</option></select>'
    +     '<button id="afAdmConfigSave" class="primary" type="button">💾 Enregistrer</button>'
    +     '<span class="small" id="afAdmConfigEtat"></span>'
    +   '</div>'
    +   '<p class="adm-af-note">Le mode <code>fonction</code> déplace la sélection côté serveur '
    +   '(<code>functions/index.js</code>, à déployer sur un plan Blaze). Sans déploiement, garde '
    +   '<code>operateur</code> : le jeu fonctionne sur un simple hébergement statique.</p>'
    + '</div>';
  }

  function injecter() {
    if (_monte) return;
    var workspace = $('adminWorkspace');
    if (!workspace) return;
    var tabs = workspace.querySelector('.admin-tabs');
    if (!tabs || workspace.querySelector('[data-pane="' + ONGLET + '"]')) {
      if (workspace.querySelector('[data-pane="' + ONGLET + '"]')) { _monte = true; brancher(); }
      return;
    }

    /* L'onglet se place AVANT « Danger » : la zone destructive reste la
       dernière, comme dans le panneau d'origine. */
    var bouton = document.createElement('button');
    bouton.className = 'admin-tab';
    bouton.type = 'button';
    bouton.setAttribute('role', 'tab');
    bouton.dataset.tab = ONGLET;
    bouton.innerHTML = '<span class="lbl-desktop">📖 Artefact</span>'
      + '<span class="lbl-mobile" aria-label="Artefact">📖</span>';
    var danger = tabs.querySelector('[data-tab="danger"]');
    if (danger) tabs.insertBefore(bouton, danger); else tabs.appendChild(bouton);

    var pane = document.createElement('div');
    pane.className = 'admin-pane';
    pane.dataset.pane = ONGLET;
    pane.style.display = 'none';
    pane.innerHTML = HTML_PANE();
    workspace.appendChild(pane);

    _monte = true;
    brancher();
  }

  /* Le panneau existant n'écoute que les onglets présents au montage :
     on reproduit ici exactement son basculement (mêmes classes, mêmes
     data-*), pour que les autres onglets continuent de masquer celui-ci. */
  function activerOnglet() {
    document.querySelectorAll('.admin-tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === ONGLET);
    });
    document.querySelectorAll('.admin-pane').forEach(function (p) {
      p.style.display = (p.dataset.pane === ONGLET ? '' : 'none');
    });
    if (!_charge) { _charge = true; rafraichirTout(); }
    else { rafraichirSessions(); rafraichirCartouches(); }
  }

  function brancher() {
    var bouton = document.querySelector('.admin-tab[data-tab="' + ONGLET + '"]');
    if (bouton) bouton.addEventListener('click', activerOnglet);

    $('afAdmOuvrir').addEventListener('click', ouvrirCoffre);
    $('afAdmPhrase').addEventListener('keydown', function (e) { if (e.key === 'Enter') ouvrirCoffre(); });
    $('afAdmFermer').addEventListener('click', function () {
      _phrase = '';
      _catalogue = null;
      $('afAdmPhrase').value = '';
      dire('afAdmPhraseEtat', 'Coffre verrouillé.', '');
      rendreCatalogue();
      rendreSessions([]);
    });

    $('afAdmMagasin').addEventListener('change', function () {
      _magasinId = this.value;
      try { localStorage.setItem(CLE_MAGASIN_ADMIN, _magasinId); } catch (e) {}
      rafraichirCartouches();
      rafraichirSessions();
    });
    $('afAdmMagasinReload').addEventListener('click', function () { chargerMagasins(true); });
    $('afAdmVerifierListe').addEventListener('click', verifierListe);
    $('afAdmPublierListe').addEventListener('click', publierListe);

    $('afAdmReconfirmer').addEventListener('click', reconfirmer);

    $('afAdmCatCharger').addEventListener('click', lireCatalogue);
    $('afAdmCatPublier').addEventListener('click', publierCatalogue);
    $('afAdmCatExporter').addEventListener('click', exporterCatalogue);
    $('afAdmCatFichier').addEventListener('change', importerFichier);
    $('afCatAjouter').addEventListener('click', ajouterOuvrage);

    $('afAdmGenerer').addEventListener('click', genererPistes);
    $('afAdmCartouchesReload').addEventListener('click', rafraichirCartouches);
    $('afAdmSessionsReload').addEventListener('click', rafraichirSessions);
    $('afAdmConfigSave').addEventListener('click', enregistrerConfig);

    /* La phrase ne doit jamais survivre à la page. */
    window.addEventListener('beforeunload', function () { _phrase = ''; _catalogue = null; });
  }

  /* ==================================================================
     2. PHRASE / COFFRE
     ================================================================== */
  function ouvrirCoffre() {
    var valeur = ($('afAdmPhrase').value || '').trim();
    if (valeur.length < 8) {
      dire('afAdmPhraseEtat', '❌ Phrase trop courte : 8 caractères minimum.', 'danger');
      return;
    }
    _phrase = valeur;
    $('afAdmPhrase').value = '';            /* jamais conservée dans le champ */
    dire('afAdmPhraseEtat', '⏳ Vérification de la phrase…', '');
    S().catalogueLire(_phrase).then(function (cat) {
      if (!cat.livres.length && !cat.version) {
        dire('afAdmPhraseEtat', '🔓 Phrase acceptée — aucun catalogue publié pour l’instant.', 'warn');
        _catalogue = [];
        rendreCatalogue();
        return;
      }
      _catalogue = cat.livres;
      dire('afAdmPhraseEtat', '🔓 Coffre ouvert : <b>' + cat.livres.length + '</b> ouvrage(s), version '
        + esc(cat.version || '?') + ' (' + esc(age(cat.majAt)) + ').', 'ok');
      rendreCatalogue();
      rafraichirSessions();
    }).catch(function (e) {
      _phrase = '';
      _catalogue = null;
      dire('afAdmPhraseEtat', '❌ ' + esc(e && e.message || e), 'danger');
    });
  }

  /* ==================================================================
     3. MAGASINS
     ================================================================== */
  function chargerMagasins(forcer) {
    if (!MG()) {
      dire('afAdmListeEtat', '❌ magasin-fnac.js n’est pas chargé sur cette page.', 'danger');
      return Promise.resolve(null);
    }
    return MG().chargerListe({ forcer: !!forcer }).then(function (liste) {
      _liste = liste;
      remplirSelecteurs(liste.magasins);
      try { _magasinId = _magasinId || localStorage.getItem(CLE_MAGASIN_ADMIN) || ''; } catch (e) {}
      var sel = $('afAdmMagasin');
      if (sel && _magasinId) sel.value = _magasinId;
      dire('afAdmListeEtat', 'Liste <b>' + esc(liste.version || '?') + '</b> — <b>' + liste.magasins.length
        + '</b> magasins (' + esc(liste.source || '?') + ', ' + esc(age(liste.syncedAt)) + '). '
        + 'Précision : ' + esc(liste.precision || 'commune') + '.', 'ok');
      rafraichirCartouches();
      rafraichirSessions();
      return liste;
    }).catch(function (e) {
      dire('afAdmListeEtat', '❌ Liste indisponible : ' + esc(e && e.message || e)
        + ' — vérifie <code>data/magasins-fnac.json</code>.', 'danger');
      return null;
    });
  }

  function remplirSelecteurs(magasins) {
    var options = ['<option value="">— Choisir un magasin —</option>'];
    magasins.forEach(function (m) {
      options.push('<option value="' + esc(m.id) + '">'
        + esc('Fnac ' + m.nom + (m.ville ? ' — ' + m.ville : '') + (m.cp ? ' (' + m.cp + ')' : '')) + '</option>');
    });
    $('afAdmMagasin').innerHTML = options.join('');
    $('afAdmMagasinDefaut').innerHTML = '<option value="">— Magasin par défaut (aucun) —</option>'
      + options.slice(1).join('');

    var types = ['<option value="">— Type d’ouvrage —</option>'];
    var vus = {};
    (M().FAMILLES || []).forEach(function (f) {
      (f.types || []).forEach(function (t) {
        if (vus[t]) return;
        vus[t] = 1;
        types.push('<option value="' + esc(t) + '">' + esc(t) + ' — ' + esc(f.id) + '</option>');
      });
    });
    $('afCatType').innerHTML = types.join('');
  }

  function verifierListe() {
    if (!_liste) { dire('afAdmListeMsg', 'Liste non chargée.', 'warn'); return; }
    var problemes = M().controlerMagasins(_liste.magasins, []);
    var actifs = M().magasinsUtilisables ? M().magasinsUtilisables(_liste.magasins).length : _liste.magasins.length;
    if (problemes.length) {
      dire('afAdmListeMsg', '❌ ' + problemes.length + ' problème(s) : '
        + esc(problemes.slice(0, 4).join(' ; ')), 'danger');
    } else {
      dire('afAdmListeMsg', '✅ Liste cohérente : ' + actifs
        + ' magasin(s) actif(s), 0 doublon, 0 identifiant manquant.', 'ok');
    }
  }

  function publierListe() {
    if (!_liste) { dire('afAdmListeMsg', 'Liste non chargée.', 'warn'); return; }
    S().publierMagasins(_liste).then(function (doc) {
      dire('afAdmListeMsg', '📤 Liste publiée dans Firestore : version <b>' + esc(doc.version) + '</b>, '
        + doc.count + ' magasins. Les joueurs la liront en priorité si elle est plus récente que le fichier.', 'ok');
      $('afAdmListePubliee').textContent = 'Publiée : ' + doc.version;
    }).catch(function (e) {
      dire('afAdmListeMsg', '❌ Publication refusée : ' + esc(e && e.message || e), 'danger');
    });
  }

  /* ==================================================================
     4. DISPONIBILITÉ
     ================================================================== */
  function reconfirmer() {
    if (!_magasinId) { dire('afAdmDispoMsg', '❌ Choisis d’abord un magasin.', 'danger'); return; }
    var delai = ($('afAdmDelai').value || '').trim();
    dire('afAdmDispoMsg', '⏳ Confirmation en cours…', '');
    S().reconfirmerDisponibilite(_magasinId, { delai: delai, phrase: _phrase || undefined })
      .then(function (r) {
        dire('afAdmDispoMsg', '✅ <b>' + r.maj + '</b> piste(s) reconfirmée(s) — délai « ' + esc(r.delai)
          + ' », horodaté ' + esc(date(r.checkedAt)) + '.'
          + (_phrase ? ' Le catalogue a suivi : les prochaines pistes générées partiront fraîches.'
                     : ' <b>Coffre verrouillé</b> : le catalogue n’a pas été mis à jour (les pistes existantes, si).'), 'ok');
        rafraichirCartouches();
      })
      .catch(function (e) {
        dire('afAdmDispoMsg', '❌ ' + esc(e && e.message || e), 'danger');
      });
  }

  /* ==================================================================
     5. CATALOGUE
     ================================================================== */
  function lireCatalogue() {
    if (!_phrase) { dire('afAdmCatEtat', '🔒 Ouvre d’abord le coffre (phrase d’administration).', 'warn'); return; }
    dire('afAdmCatEtat', '⏳ Lecture…', '');
    S().catalogueLire(_phrase).then(function (cat) {
      _catalogue = cat.livres;
      dire('afAdmCatEtat', '✅ ' + cat.livres.length + ' ouvrage(s) — version ' + esc(cat.version || '?')
        + ' (' + esc(age(cat.majAt)) + ').', 'ok');
      rendreCatalogue();
    }).catch(function (e) {
      dire('afAdmCatEtat', '❌ ' + esc(e && e.message || e), 'danger');
    });
  }

  function rendreCatalogue() {
    var hote = $('afAdmCatTable');
    if (!hote) return;
    if (!_catalogue) { hote.innerHTML = ''; return; }
    if (!_catalogue.length) {
      hote.innerHTML = '<p class="adm-af-note">Catalogue vide. Ajoute au moins un ouvrage compatible, '
        + 'puis publie-le.</p>';
      return;
    }
    var lignes = _catalogue.map(function (l, i) {
      var dispo = (l.disponibilite || {})[_magasinId];
      var frais = dispo ? M().disponibiliteValide(dispo, _magasinId, {}) : { ok: false, motif: 'aucune disponibilité' };
      return '<tr>'
        + '<td>' + esc(l.titre) + '<br><span class="small">' + esc(l.auteur || '?') + ' · '
        +   esc(l.editeur || '?') + ' · ' + esc(l.edition || 'édition ?') + '</span></td>'
        + '<td><code>' + esc(l.ean) + '</code><br><span class="small">SKU ' + esc(l.sku || '—') + '</span></td>'
        + '<td>' + esc(l.type || '?') + '<br><span class="small">' + esc(l.categorieFnac || '') + '</span></td>'
        + '<td>' + (l.vendeur === 'partenaire'
            ? '<span class="adm-af-badge adm-af-badge--warn">partenaire</span>'
            : '<span class="adm-af-badge adm-af-badge--ok">Fnac</span>')
        +   '<br><span class="small">' + esc(l.rayon || '—') + '</span></td>'
        + '<td>' + (frais.ok
            ? '<span class="adm-af-badge adm-af-badge--ok">frais</span>'
            : '<span class="adm-af-badge adm-af-badge--warn">' + esc(frais.motif) + '</span>')
        +   '<br><span class="small">' + esc(dispo && dispo.delai || '—') + '</span></td>'
        + '<td><button class="secondary adm-af-mini" data-cat-sup="' + i + '" type="button">🗑️ Retirer</button></td>'
        + '</tr>';
    }).join('');
    hote.innerHTML = '<table class="adm-af-table"><thead><tr><th>Ouvrage</th><th>EAN / SKU</th>'
      + '<th>Type</th><th>Vendeur</th><th>Dispo ' + esc(_magasinId || '?') + '</th><th></th></tr></thead>'
      + '<tbody>' + lignes + '</tbody></table>';
    hote.querySelectorAll('[data-cat-sup]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.dataset.catSup);
        if (!window.confirm('Retirer « ' + _catalogue[i].titre + ' » du catalogue ?\n'
          + 'La publication est nécessaire pour que ce soit effectif.')) return;
        _catalogue.splice(i, 1);
        rendreCatalogue();
        dire('afAdmCatMsg', 'Ouvrage retiré de la copie de travail — publie pour enregistrer.', 'warn');
      });
    });
  }

  function ajouterOuvrage() {
    if (!_catalogue) _catalogue = [];
    var brut = {
      titre: $('afCatTitre').value,
      auteur: $('afCatAuteur').value,
      auteurType: $('afCatAuteurType').value,
      editeur: $('afCatEditeur').value,
      edition: $('afCatEdition').value,
      editionNumero: Number($('afCatEditionNumero').value || 0),
      annee: Number($('afCatAnnee').value || 0),
      ean: $('afCatEan').value,
      sku: $('afCatSku').value,
      categorieFnac: $('afCatCategorie').value,
      rayon: $('afCatRayon').value,
      type: $('afCatType').value,
      vendeur: $('afCatVendeur').value
    };
    var v = M().validerLivre(brut);
    if (!v.livre) {
      dire('afAdmCatMsg', '❌ Ouvrage refusé : ' + esc(v.erreurs.join(' ; ')), 'danger');
      return;
    }
    var livre = v.livre;
    livre.id = M().normaliser(livre.titre + ' ' + (livre.editionNumero || livre.annee || '')).replace(/[^a-z0-9]+/g, '-').slice(0, 48);
    /* La disponibilité du magasin de travail est reprise telle quelle :
       l'organisateur vient de la vérifier. */
    if (_magasinId) {
      livre.disponibilite = livre.disponibilite || {};
      livre.disponibilite[_magasinId] = Object.assign({}, (livre.disponibilite || {})[_magasinId], {
        statut: 'disponible', delai: ($('afAdmDelai').value || 'Retrait gratuit sous 1H'),
        checkedAt: new Date().toISOString(), vendeur: livre.vendeur || 'fnac', magasin: _magasinId
      });
    }
    _catalogue.push(livre);
    ['afCatTitre', 'afCatAuteur', 'afCatEditeur', 'afCatEdition', 'afCatEditionNumero', 'afCatAnnee',
     'afCatEan', 'afCatSku', 'afCatCategorie', 'afCatRayon'].forEach(function (id) { $(id).value = ''; });
    rendreCatalogue();
    dire('afAdmCatMsg', '✅ « ' + esc(livre.titre) + ' » ajouté à la copie de travail (' + _catalogue.length
      + ' ouvrage(s)). Publie le catalogue pour l’enregistrer chiffré.', 'ok');
  }

  function publierCatalogue() {
    if (!_phrase) { dire('afAdmCatMsg', '🔒 Ouvre d’abord le coffre.', 'warn'); return; }
    if (!_catalogue) { dire('afAdmCatMsg', '❌ Rien à publier : lis ou importe d’abord un catalogue.', 'danger'); return; }
    if (!_catalogue.length) {
      if (!window.confirm('Publier un catalogue VIDE ? Aucune piste ne pourra plus être générée.')) return;
    }
    dire('afAdmCatMsg', '⏳ Chiffrement et publication…', '');
    S().catalogueEcrire(_catalogue, _phrase).then(function (r) {
      dire('afAdmCatMsg', '🔐 Catalogue publié : <b>' + r.count + '</b> ouvrage(s), version ' + esc(r.version)
        + (r.problemes.length ? '. ⚠️ ' + r.problemes.length + ' fiche(s) écartée(s) : '
          + esc(r.problemes.slice(0, 3).map(function (p) { return p.id + ' (' + p.erreurs.join(', ') + ')'; }).join(' ; '))
          : '') + '.', r.problemes.length ? 'warn' : 'ok');
      lireCatalogue();
    }).catch(function (e) {
      dire('afAdmCatMsg', '❌ ' + esc(e && e.message || e), 'danger');
    });
  }

  function exporterCatalogue() {
    if (!_catalogue || !_catalogue.length) { dire('afAdmCatMsg', 'Rien à exporter.', 'warn'); return; }
    /* Export LOCAL (téléchargement) : ne jamais déposer ce fichier dans le
       dépôt — GitHub Pages le servirait publiquement. */
    var blob = new Blob([JSON.stringify({ version: 'export-admin', count: _catalogue.length, livres: _catalogue }, null, 2)],
      { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'catalogue-artefacts-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    dire('afAdmCatMsg', '⬇️ Export téléchargé. ⚠️ Ce fichier contient les solutions : ne le mets JAMAIS dans le dépôt '
      + '(range-le dans <code>.nautilus-safe/</code>, déjà ignoré par git).', 'warn');
  }

  function importerFichier(e) {
    var fichier = e.target.files && e.target.files[0];
    if (!fichier) return;
    var lecteur = new FileReader();
    lecteur.onload = function () {
      try {
        var doc = JSON.parse(String(lecteur.result));
        var livres = Array.isArray(doc) ? doc : (doc.livres || []);
        if (!livres.length) throw new Error('aucun ouvrage dans ce fichier');
        var ok = 0, ko = [];
        livres.forEach(function (brut) {
          var v = M().validerLivre(brut);
          if (!v.livre) { ko.push((brut.titre || brut.id || '?') + ' : ' + v.erreurs.join(', ')); return; }
          var l = v.livre;
          if (!l.id) l.id = M().normaliser(l.titre).replace(/[^a-z0-9]+/g, '-').slice(0, 48);
          if (_magasinId && !(l.disponibilite || {})[_magasinId]) {
            l.disponibilite = l.disponibilite || {};
            l.disponibilite[_magasinId] = { statut: 'disponible',
              delai: ($('afAdmDelai').value || 'Retrait gratuit sous 1H'),
              checkedAt: new Date().toISOString(), vendeur: l.vendeur || 'fnac', magasin: _magasinId };
          }
          _catalogue = _catalogue || [];
          var existant = _catalogue.filter(function (c) { return c.ean === l.ean; })[0];
          if (existant) Object.assign(existant, l); else _catalogue.push(l);
          ok++;
        });
        rendreCatalogue();
        dire('afAdmCatMsg', '📥 ' + ok + ' ouvrage(s) importé(s)' + (ko.length
          ? ', ' + ko.length + ' refusé(s) : ' + esc(ko.slice(0, 3).join(' ; ')) : '')
          + '. Publie pour enregistrer chiffré.', ko.length ? 'warn' : 'ok');
      } catch (err) {
        dire('afAdmCatMsg', '❌ Import impossible : ' + esc(err && err.message || err), 'danger');
      }
      e.target.value = '';
    };
    lecteur.readAsText(fichier);
  }

  /* ==================================================================
     6. PISTES (CARTOUCHES)
     ================================================================== */
  function genererPistes() {
    if (!_magasinId) { dire('afAdmCartouchesMsg', '❌ Choisis d’abord un magasin.', 'danger'); return; }
    if (!_phrase) { dire('afAdmCartouchesMsg', '🔒 Ouvre le coffre : les réponses sont stockées chiffrées.', 'warn'); return; }
    dire('afAdmCartouchesMsg', '⏳ Génération (une empreinte d’EAN coûte ~0,6 s par piste)…', '');
    S().genererCartouchesPour(_magasinId, { phrase: _phrase })
      .then(function (r) {
        dire('afAdmCartouchesMsg', '⚙️ <b>' + r.faites.length + '</b> piste(s) générée(s)'
          + (r.erreurs.length ? ', ' + r.erreurs.length + ' échec(s) : '
            + esc(r.erreurs.slice(0, 3).map(function (e) { return e.livre + ' — ' + e.erreur; }).join(' ; ')) : '')
          + (r.ecartes.length ? '. Écartés de la sélection : ' + esc(r.ecartes.slice(0, 4).map(function (e) {
              return e.id + ' (' + e.motif + ')'; }).join(' ; ')) : '') + '.',
          r.faites.length ? 'ok' : 'warn');
        rafraichirCartouches();
      })
      .catch(function (e) {
        dire('afAdmCartouchesMsg', '❌ ' + esc(e && e.message || e), 'danger');
      });
  }

  function rafraichirCartouches() {
    var etat = $('afAdmCartouchesEtat');
    if (!S() || !etat) return Promise.resolve();
    return S().listerCartouches(_magasinId || undefined).then(function (docs) {
      etat.textContent = docs.length + ' piste(s)' + (_magasinId ? ' pour ' + _magasinId : ' (tous magasins)');
      var hote = $('afAdmCartouchesTable');
      if (!docs.length) {
        hote.innerHTML = '<p class="adm-af-note">Aucune piste. Confirme la disponibilité puis génère.</p>';
        return;
      }
      hote.innerHTML = '<table class="adm-af-table"><thead><tr><th>Piste</th><th>Énigme</th>'
        + '<th>Magasin</th><th>Disponibilité</th><th></th></tr></thead><tbody>'
        + docs.map(function (c) {
            var frais = M().disponibiliteValide(c.disponibilite, c.magasinId, {});
            return '<tr>'
              + '<td><code>' + esc(c._id || c.id) + '</code><br><span class="small">'
              +   esc(c.famille || '?') + ' · ' + esc(c.etapes ? c.etapes.length : 0) + ' étapes</span></td>'
              + '<td><span class="small">' + esc(String(c.indice || '').split('\n')[0]) + '…</span></td>'
              + '<td>' + esc(c.magasinId || '—') + '</td>'
              + '<td>' + (frais.ok
                  ? '<span class="adm-af-badge adm-af-badge--ok">fraîche</span>'
                  : '<span class="adm-af-badge adm-af-badge--warn">' + esc(frais.motif) + '</span>')
              +   '<br><span class="small">' + esc(age(c.disponibilite && c.disponibilite.checkedAt)) + '</span></td>'
              + '<td><button class="danger adm-af-mini" data-cart-sup="' + esc(c._id || c.id)
              +   '" type="button">🗑️</button></td>'
              + '</tr>';
          }).join('')
        + '</tbody></table>';
      hote.querySelectorAll('[data-cart-sup]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.dataset.cartSup;
          if (!window.confirm('Supprimer la piste ' + id + ' ?\nUne session en cours qui l’utilise devra être resélectionnée.')) return;
          S().supprimerCartouche(id).then(function () { rafraichirCartouches(); });
        });
      });
    }).catch(function (e) {
      etat.textContent = 'lecture impossible : ' + (e && e.message || e);
    });
  }

  /* ==================================================================
     7. SESSIONS
     ================================================================== */
  function rafraichirSessions() {
    if (!S()) return Promise.resolve();
    var etat = $('afAdmSessionsEtat');
    if (!etat) return Promise.resolve();
    etat.textContent = 'chargement…';
    return S().stockage().lister(S().CHEMINS.sessions).then(function (docs) {
      if (!docs.length) {
        etat.textContent = '0 session';
        $('afAdmSessionsTable').innerHTML = '<p class="adm-af-note">Aucune session. Un équipage doit lancer le Palier 3.</p>';
        return;
      }
      var sessions = docs.filter(function (s) { return !_magasinId || !s.magasinId || s.magasinId === _magasinId; });
      etat.textContent = sessions.length + ' session(s)' + (_magasinId ? ' pour ' + _magasinId : '');
      return Promise.all(sessions.map(function (s) {
        return (_phrase && s.cartoucheId)
          ? S().lireCoffre(s.cartoucheId, _phrase).catch(function () { return null; })
          : Promise.resolve(null);
      })).then(function (coffres) {
        rendreSessions(sessions.map(function (s, i) { return { session: s, coffre: coffres[i] }; }));
      });
    }).catch(function (e) {
      etat.textContent = 'lecture impossible : ' + (e && e.message || e);
    });
  }

  function texteIndiceExact(coffre, rang) {
    if (!coffre || !coffre.livre) return '';
    var l = coffre.livre;
    if (Number(rang) === 1) {
      return 'Le premier refuge se trouve au rayon « ' + (l.rayon || '?') + ' »'
        + (l.categorieFnac ? ' (fiche : ' + l.categorieFnac + ')' : '') + '.';
    }
    if (Number(rang) === 2) {
      return 'L’édition recherchée est « ' + (l.edition || '?') + ' »'
        + (l.editionNumero ? ' — numéro ' + l.editionNumero : '') + '.';
    }
    return 'L’ouvrage est signé : « ' + (l.auteur || '?') + ' ».';
  }

  function rendreSessions(lignes) {
    var hote = $('afAdmSessionsTable');
    if (!hote) return;
    if (!lignes || !lignes.length) {
      hote.innerHTML = '<p class="adm-af-note">' + (_phrase
        ? 'Aucune session pour ce magasin.' : 'Ouvre le coffre pour voir les ouvrages affectés.') + '</p>';
      return;
    }
    hote.innerHTML = lignes.map(function (l) {
      var s = l.session, c = l.coffre;
      var etapes = (s.cartouche && s.cartouche.etapes) || [];
      var validees = s.etapesValidees || [];
      var etapeNom = etapes.length ? (etapes[Math.min(s.etape || 0, etapes.length - 1)] || {}).libelle || '?' : '?';
      var badge = s.statut === 'terminee' ? 'ok' : s.statut === 'suspendue' ? 'danger' : 'warn';
      var demande = s.demandeIndice;
      return '<div class="adm-af-sec" style="margin-bottom:10px">'
        + '<h4>🚢 ' + esc(s.equipe || s._id) + ' — <span class="adm-af-badge adm-af-badge--' + badge + '">'
        +   esc(s.statut || '?') + '</span></h4>'
        + '<p class="adm-af-note">Magasin <b>' + esc(s.magasinId || '?') + '</b> · piste <code>'
        +   esc(s.cartoucheId || '—') + '</code> · étape <b>' + esc(etapeNom) + '</b> ('
        +   validees.length + '/' + etapes.length + ') · réponses refusées <b>' + Number(s.erreurs || 0) + '</b>'
        +   ' · indices <b>' + ((s.indicesUtilises || []).length) + '</b>'
        +   (s.selectionneLe ? ' · affectée ' + esc(age(s.selectionneLe)) : '') + '</p>'
        + (c && c.livre
          ? '<p class="adm-af-note">📖 <b>' + esc(c.livre.titre) + '</b> — ' + esc(c.livre.auteur || '?')
            + ', ' + esc(c.livre.editeur || '?') + ', ' + esc(c.livre.edition || 'éd. ?')
            + ' · EAN <code>' + esc(c.livre.ean) + '</code> · SKU <code>' + esc(c.livre.sku || '—') + '</code>'
            + ' · règle ' + esc(c.regle) + ' · ordre ' + esc(c.ordre) + '</p>'
          : '<p class="adm-af-note">🔒 Ouvrage masqué (coffre verrouillé).</p>')
        + (s.introuvable
          ? '<p class="adm-af-note"><b>📵 Signalé introuvable</b> le ' + esc(date(s.introuvable.signaleLe))
            + ' par ' + esc(s.introuvable.par || 'un matelot') + '.</p>' : '')
        + (s.remplacement
          ? '<p class="adm-af-note"><b>🔁 Piste remplacée</b> : ' + esc(s.remplacement.ancienCartoucheId)
            + ' → ' + esc(s.remplacement.nouveauCartoucheId) + ' (' + esc(s.remplacement.raison) + ', '
            + esc(s.remplacement.par) + ', ' + esc(date(s.remplacement.le)) + ').</p>' : '')
        + (demande
          ? '<div class="adm-af-ligne" style="margin-top:8px">'
          +   '<span class="adm-af-badge adm-af-badge--warn">🕯️ indice « ' + esc(demande.cle) + ' » demandé ('
          +     esc(demande.heures) + ' h)</span>'
          +   '<input class="adm-af-input" id="afAdmIndice_' + esc(s.equipe) + '" value="'
          +     esc(texteIndiceExact(c, demande.rang)) + '" placeholder="Texte à transmettre">'
          +   '<button class="primary" type="button" data-ind-trans="' + esc(s.equipe) + '" data-ind-rang="'
          +     esc(demande.rang) + '">📯 Transmettre l’indice</button>'
          + '</div>'
          + (c ? '' : '<p class="adm-af-note">⚠️ Ouvre le coffre pour pré-remplir la valeur exacte.</p>')
          : '')
        + '<div class="adm-af-ligne" style="margin-top:8px">'
        +   '<button class="primary" type="button" data-resel="' + esc(s.equipe) + '">🔁 Resélectionner le livre</button>'
        +   '<button class="danger" type="button" data-indisp="' + esc(s.equipe) + '">🚫 Marquer l’ouvrage indisponible</button>'
        +   '<button class="secondary" type="button" data-reinit="' + esc(s.equipe) + '">♻️ Réinitialiser la session</button>'
        + '</div>'
        + '<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700">📜 Historique ('
        +   ((s.historique || []).length) + ')</summary><ul class="adm-af-hist">'
        +   (s.historique || []).slice().reverse().map(function (h) {
              return '<li>' + esc(date(h.le)) + ' — <b>' + esc(h.type) + '</b> : ' + esc(h.texte) + '</li>';
            }).join('')
        + '</ul></details>'
        + '</div>';
    }).join('');

    hote.querySelectorAll('[data-ind-trans]').forEach(function (b) {
      b.addEventListener('click', function () {
        var equipe = b.dataset.indTrans, rang = Number(b.dataset.indRang);
        var texte = ($('afAdmIndice_' + equipe) || {}).value || '';
        S().transmettreIndice(equipe, rang, texte).then(function (r) {
          dire('afAdmSessionsMsg', '📯 Indice « ' + esc(b.dataset.indRang === '1' ? 'rayon' : b.dataset.indRang === '2' ? 'édition' : 'auteur') + ' » transmis à ' + esc(equipe) + '.', 'ok');
          rafraichirSessions();
        }).catch(function (e) {
          dire('afAdmSessionsMsg', '❌ ' + esc(e && e.message || e), 'danger');
        });
      });
    });

    hote.querySelectorAll('[data-resel]').forEach(function (b) {
      b.addEventListener('click', function () {
        var equipe = b.dataset.resel;
        var raison = window.prompt('Resélectionner un autre ouvrage pour ' + equipe + ' ?\n'
          + 'Motif (facultatif) :', 'ouvrage-indisponible');
        if (raison === null) return;
        b.disabled = true;
        S().reselectionner(equipe, { raison: raison, par: 'capitaine', introuvable: /introuvable/.test(raison) })
          .then(function (r) {
            if (!r.ok) {
              window.alert('⚠️ ' + (r.message || r.motif)
                + '\n\nProgression conservée. Confirme d’abord la disponibilité d’autres ouvrages, puis régénère les pistes.');
            } else {
              window.alert('✅ Nouvelle piste affectée : ' + r.cartoucheId
                + (r.sceauReinitialise
                  ? '\nLe sceau avait déjà reconnu l’ancien ouvrage : la séquence liée à l’ouvrage repart de zéro (aucune erreur ajoutée).'
                  : '\nProgression conservée, aucune erreur ajoutée.'));
            }
            rafraichirSessions();
          })
          .catch(function (e) {
            window.alert('❌ ' + (e && e.message || e));
            b.disabled = false;
            rafraichirSessions();
          });
      });
    });

    hote.querySelectorAll('[data-indisp]').forEach(function (b) {
      b.addEventListener('click', function () {
        var equipe = b.dataset.indisp;
        var ligne = lignes.filter(function (l) { return (l.session.equipe || l.session._id) === equipe; })[0];
        var cartoucheId = ligne && ligne.session.cartoucheId;
        if (!cartoucheId) { window.alert('Aucune piste affectée à cet équipage.'); return; }
        if (!window.confirm('Marquer la piste ' + cartoucheId + ' indisponible, puis resélectionner pour ' + equipe + ' ?')) return;
        S().marquerIndisponible(cartoucheId, 'signalé par le capitaine')
          .then(function () { return S().reselectionner(equipe, { raison: 'ouvrage-indisponible', par: 'capitaine' }); })
          .then(function (r) {
            window.alert(r.ok ? '✅ Piste marquée indisponible et remplacée : ' + r.cartoucheId
              : '⚠️ Piste marquée indisponible, mais ' + (r.message || r.motif));
            rafraichirCartouches();
            rafraichirSessions();
          })
          .catch(function (e) { window.alert('❌ ' + (e && e.message || e)); rafraichirSessions(); });
      });
    });

    hote.querySelectorAll('[data-reinit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var equipe = b.dataset.reinit;
        if (!window.confirm('Réinitialiser complètement la session de ' + equipe + ' ?\n'
          + 'Progression, erreurs et indices seront effacés.')) return;
        S().reinitialiser(equipe, { par: 'capitaine' }).then(function () {
          dire('afAdmSessionsMsg', '♻️ Session de ' + esc(equipe) + ' réinitialisée.', 'ok');
          rafraichirSessions();
        }).catch(function (e) {
          dire('afAdmSessionsMsg', '❌ ' + esc(e && e.message || e), 'danger');
        });
      });
    });
  }

  /* ==================================================================
     8. CONFIGURATION
     ================================================================== */
  function rafraichirConfig() {
    return S().config({ forcer: true }).then(function (cfg) {
      $('afAdmMode').value = cfg.mode || 'operateur';
      $('afAdmEndpoint').value = cfg.endpoint || '';
      $('afAdmFenetre').value = cfg.fenetreMinutes || 15;
      if (cfg.magasinDefaut && $('afAdmMagasinDefaut')) $('afAdmMagasinDefaut').value = cfg.magasinDefaut;
      $('afAdmConfigEtat').textContent = 'Catalogue ' + (cfg.catalogueVersion || '—')
        + ' · liste ' + (cfg.magasinsVersion || '—');
      return cfg;
    }).catch(function () {});
  }

  function enregistrerConfig() {
    var champs = {
      mode: $('afAdmMode').value,
      endpoint: ($('afAdmEndpoint').value || '').trim(),
      fenetreMinutes: Math.max(1, Number($('afAdmFenetre').value) || 15),
      magasinDefaut: $('afAdmMagasinDefaut').value || ''
    };
    if (champs.mode === 'fonction' && !/^https:\/\/.+/.test(champs.endpoint)) {
      dire('afAdmConfigEtat', '❌ Le mode « fonction » exige une URL HTTPS.', 'danger');
      return;
    }
    S().ecrireConfig(champs).then(function (cfg) {
      dire('afAdmConfigEtat', '💾 Configuration enregistrée : mode <b>' + esc(cfg.mode) + '</b>, fenêtre '
        + cfg.fenetreMinutes + ' min' + (cfg.magasinDefaut ? ', magasin par défaut ' + esc(cfg.magasinDefaut) : '') + '.', 'ok');
    }).catch(function (e) {
      dire('afAdmConfigEtat', '❌ ' + esc(e && e.message || e), 'danger');
    });
  }

  /* ==================================================================
     9. RAFRAÎCHISSEMENT GLOBAL + MONTAGE
     ================================================================== */
  function rafraichirTout() {
    rafraichirConfig();
    chargerMagasins(false);
    rafraichirCartouches();
    rafraichirSessions();
  }

  function observer() {
    if ($('adminWorkspace')) { injecter(); return; }
    var mo = new MutationObserver(function () {
      if ($('adminWorkspace')) {
        injecter();
        /* Le panneau peut être monté APRÈS l'injection (admin-button.js est
           un module) : on réessaie tant que l'onglet n'est pas en place. */
        if (!_monte) return;
        mo.disconnect();
      }
    });
    mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { injecter(); }, 1200);
    setTimeout(function () { injecter(); }, 3500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observer);
  } else {
    observer();
  }

  window.NautilusAdminArtefact = {
    ONGLET: ONGLET,
    injecter: injecter,
    activerOnglet: activerOnglet,
    rafraichirTout: rafraichirTout,
    texteIndiceExact: texteIndiceExact,
    estMonte: function () { return _monte; },
    phraseActive: function () { return !!_phrase; }
  };
})();
