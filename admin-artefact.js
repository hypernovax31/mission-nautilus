/* =====================================================================
   admin-artefact.js — ONGLETS ADMIN « 🏪 Magasins » + « 🔑 Réponses »
   Remplace l'ancien onglet « Artefact » :

   1) 🏪 Magasins — mise à jour manuelle de la liste Fnac si l'automatisation
      n'a pas eu lieu. Affiche la date de dernière MAJ (auto/manuelle) et
      permet recharger / vérifier / publier / exporter.

   2) 🔑 Réponses — voir les bonnes réponses attendues des mini-jeux
      (4 étapes) pour chaque équipage. Nécessite la phrase d'administration.

   Injection légère dans le panneau admin existant (admin-button.js)
   ===================================================================== */
(function () {
  'use strict';
  if (window.NautilusAdminArtefact) return;

  var ONGLET_MAG = 'magasins';
  var ONGLET_REP = 'reponses';
  var _monte = false;
  var _liste = null;
  var _filtre = '';
  var _phrase = '';
  function ensureTabsCss(){
    if(document.getElementById('nautilusAdminTabsFix')) return;
    var st=document.createElement('style');
    st.id='nautilusAdminTabsFix';
    st.textContent='.admin-tabs{display:flex;flex-wrap:nowrap;gap:4px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:4px}.admin-tabs::-webkit-scrollbar{display:none}.admin-tab{flex:0 0 auto;white-space:nowrap;min-width:36px;justify-content:center}.admin-pane{min-width:0;overflow-wrap:anywhere;max-width:100%}#adminPanel .body{overflow-x:hidden}';
    (document.head||document.documentElement).appendChild(st);
  }

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function S() { return window.NautilusArtefact; }
  function MG() { return window.NautilusMagasin; }
  function M() { return window.NautilusArtefactMoteur; }

  function dire(id, html, kind) {
    var el = $(id);
    if (!el) return;
    el.innerHTML = html;
    el.className = 'adm-af-msg ' + (kind || '');
    el.style.color = kind === 'ok' ? '#075c39' : kind === 'danger' ? '#9b1111' : kind === 'warn' ? '#8a5b00' : '';
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' UTC';
    } catch (e) { return esc(iso); }
  }
  function fmtSource(src, srcType) {
    var s = String(src || '') + ' ' + String(srcType || '');
    if (/panneau-admin/i.test(s)) return '<span class="adm-af-badge adm-af-badge--warn">manuelle — panneau admin</span>';
    if (/automate-hebdo/i.test(s) || /fnac\.com/i.test(s) || /fnac-official/i.test(s)) return '<span class="adm-af-badge adm-af-badge--ok">automatique — fnac.com</span>';
    if (/sync-automatique/i.test(s)) return '<span class="adm-af-badge adm-af-badge--ok">automatique</span>';
    return src ? '<span class="adm-af-badge">' + esc(src) + '</span>' : '<span class="adm-af-badge">inconnue</span>';
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

  function HTML_MAG() {
    return ''
    + '<p class="small" style="margin-bottom:10px">Liste des <b>magasins Fnac</b> pour le Palier 3. Elle détermine où l’ouvrage peut être cherché. Source : <code>data/magasins-fnac.json</code> (ou Firestore si publiée plus récemment).</p>'
    + '<div class="adm-af-sec">'
    +   '<h4>📍 Magasins — mise à jour</h4>'
    +   '<div id="afMagLast" class="adm-af-note" style="background:#f6f8fb;border:1px solid #dfe8ee;border-radius:8px;padding:8px 10px;margin-bottom:8px">Chargement…</div>'
    +   '<div class="adm-af-ligne">'
    +     '<button id="afMagReload" class="secondary" type="button">↻ Recharger</button>'
    +     '<button id="afMagVerifier" class="secondary" type="button">🧪 Vérifier</button>'
    +     '<button id="afMagPublier" class="primary" type="button">📤 Publier (Firestore)</button>'
    +     '<button id="afMagExporter" class="secondary" type="button">⬇️ Exporter JSON</button>'
    +   '</div>'
    +   '<p class="adm-af-note" id="afMagEtat">Chargement…</p>'
    +   '<p class="adm-af-note" id="afMagMsg"></p>'
    +   '<div class="adm-af-ligne" style="margin-top:8px">'
    +     '<input id="afMagSearch" class="adm-af-input" placeholder="🔍 Filtrer (nom, ville, CP, id)" style="flex:1">'
    +     '<span class="small" id="afMagCount"></span>'
    +   '</div>'
    +   '<div id="afMagTable" style="margin-top:8px;max-height:360px;overflow:auto;border:1px solid #dfe8ee;border-radius:8px"></div>'
    + '</div>'
    + '<div class="adm-af-sec">'
    +   '<h4>➕ Ajouter / éditer un magasin</h4>'
    +   '<p class="adm-af-note">Renseigne au minimum <b>id</b> (ex. cl999) et <b>nom</b>. La publication rend la liste active pour les joueurs ; l’export JSON sert à committer le fichier.</p>'
    +   '<div class="adm-af-ligne">'
    +     '<input id="afMagId" class="adm-af-input" placeholder="id — ex. cl999" style="max-width:120px">'
    +     '<input id="afMagNom" class="adm-af-input" placeholder="Nom — ex. Labège" style="flex:1">'
    +     '<input id="afMagVille" class="adm-af-input" placeholder="Ville" style="flex:1">'
    +     '<input id="afMagCp" class="adm-af-input" placeholder="CP" style="max-width:100px">'
    +   '</div>'
    +   '<div class="adm-af-ligne">'
    +     '<input id="afMagLat" class="adm-af-input" type="number" step="any" placeholder="lat" style="max-width:120px">'
    +     '<input id="afMagLon" class="adm-af-input" type="number" step="any" placeholder="lon" style="max-width:120px">'
    +     '<input id="afMagSlug" class="adm-af-input" placeholder="slug — ex. Labege/Fnac-Labege" style="flex:1">'
    +   '</div>'
    +   '<div class="adm-af-ligne">'
    +     '<button id="afMagAjouter" class="primary" type="button">➕ Ajouter / Mettre à jour</button>'
    +     '<button id="afMagVider" class="secondary" type="button">🧹 Vider le formulaire</button>'
    +     '<span class="small" id="afMagFormMsg"></span>'
    +   '</div>'
    + '</div>'
    + '<p class="adm-af-note" style="margin-top:8px">💡 Sync hebdo : <code>tools/sync-magasins-fnac.mjs</code> + GitHub Actions régénère <code>data/magasins-fnac.json</code>. Les modifs manuelles ici sont prioritaires si publiées dans Firestore.</p>';
  }

  // ── Référentiel statique des réponses — tous paliers ──
  // Source de vérité : palier1.html:MORSE_WORDS (40 mots) + 1721310619.html:MOTS (11 mots)
  var REF_P1 = [
    {w:'NAUTILE',h:'Animal marin à coquille spiralée'},{w:'ABYSSES',h:'Profondeurs inexplorées de l\'océan'},{w:'EPAVES',h:'Épave = navire échoué au fond'},{w:'EQUATEUR',h:'Ligne imaginaire autour de la Terre'},{w:'OCEANES',h:'Vastes mers salées'},{w:'RECIFAL',h:'Qualifie un récif corallien'},{w:'SOUSMARIN',h:'Bateau qui plonge sous l\'eau'},{w:'BARQUES',h:'Petits bateaux de pêche'},{w:'PHOQUES',h:'Mammifères marins à nageoires'},{w:'CETACES',h:'Famille des baleines et dauphins'},{w:'CORAIL',h:'Animal qui forme les récifs'},{w:'MEDUSES',h:'Animaux gélatineux urticants'},{w:'OURSINS',h:'Petits animaux à piquants'},{w:'CRUSTACE',h:'Famille du crabe et de la crevette'},{w:'BALEINES',h:'Plus grands animaux marins'},{w:'DAUPHINS',h:'Cétacés intelligents et joueurs'},{w:'REQUINS',h:'Prédateurs au sourire de dents'},{w:'ANCHOIS',h:'Petits poissons bleus en banc'},{w:'SARDINES',h:'Petits poissons pêchés en boîte'},{w:'MOULES',h:'Mollusques des rochers'},{w:'HUITRES',h:'Mollusques précieux pour leurs perles'},{w:'CREVETTES',h:'Petits crustacés roses'},{w:'LANGOUSTE',h:'Grand crustacé à longues antennes'},{w:'MAREEES',h:'Mouvement quotidien de la mer'},{w:'COURANTS',h:'Flux d\'eau continus dans l\'océan'},{w:'VAGUES',h:'Elles roulent vers le rivage'},{w:'ECUMES',h:'Mousse blanche sur les crêtes'},{w:'ALGUES',h:'Végétaux marins'},{w:'MANGROVE',h:'Forêt des zones côtières tropicales'},{w:'PROMENADE',h:'Chemin le long de la côte'},{w:'PHARE',h:'Tour qui guide les navires'},{w:'MARINIER',h:'Qui concerne les marins'},{w:'PIRATES',h:'Ecumeurs des mers du temps de la voile'},{w:'FLIBUSTIER',h:'Pirate des Antilles'},{w:'EQUIPAGES',h:'Équipes à bord d\'un navire'},{w:'MATELOTS',h:'Marins d\'équipage'},{w:'CAPITAINE',h:'Commandant d\'un navire'},{w:'AMIRAUTE',h:'Commandement supérieur de la marine'},{w:'CHALUTIER',h:'Bateau de pêche au filet'},{w:'SOUSMARINE',h:'Autre orthographe du sous-marin'}
  ];
  var REF_P2 = [
    {reponse:'STEELBOOK',definition:'Coffret plat à deux volets, trempé contre l\'oubli, dont la surface polie renvoie au possesseur son propre visage avant de lui concéder l\'accès à la fiction qu\'il abrite.',secteur:'rayon'},
    {reponse:'ECOTAXE',definition:'Obole de compensation opérée à l\'instant de l\'acquisition, destinée à provisionner la cérémonie ultérieure de démantèlement et la restauration des équilibres que l\'objet aura fatigués par sa seule circulation.',secteur:'caisse'},
    {reponse:'PICKING',definition:'Protocole chrono-opérationnel de matérialisation sélective, piloté par une matrice d\'allocation omnicanale, qui convertit une intention transactionnelle en micro-séquences de navigation tactile au sein d\'un environnement indexé, jusqu\'à stabilisation de l\'unité désignée dans son vecteur de circulation.',secteur:'stock'},
    {reponse:'ANTISKATING',definition:'Procédé métaphysique chargé de stabiliser la dérive latérale d\'un vecteur acoustico-mental en injectant, dans la trajectoire d\'un sillon cognitif, une contre-résonance spectrale destinée à empêcher la pensée non formulée de glisser vers son propre centre.',secteur:'rayon'},
    {reponse:'NEURONAL',definition:'Accélérateur matériel pour opérations de réduction dimensionnelle sur espaces vectoriels de grande dimension, avec pipeline dédié aux produits scalaires massivement parallèles.',secteur:'rayon'},
    {reponse:'RAYTRACING',definition:'Opération de cartographie négative où l\'on ne décrit pas ce qui est, mais ce qu\'un parcours hypothétique aurait dû rencontrer pour que l\'apparence finale puisse justifier sa propre présence.',secteur:'rayon'},
    {reponse:'REASSORT',definition:'Cycle régénératif à cadence différée qui restaure l\'équilibre densitaire d\'un ensemble ordonné, en réinjectant depuis une réserve latente les unités manquantes d\'une trame consommée, jusqu\'à rétablissement de la continuité perceptive de l\'alignement.',secteur:'stock'},
    {reponse:'REPRISE',definition:'Clause de filiation inversée consentie à tout bien vieillissant : l\'opérateur d\'origine l\'absorbe à nouveau, en négocie la déchéance selon un barème d\'érosion, puis lui désigne un successeur qui ignorera tout de l\'aîné.',secteur:'sav'},
    {reponse:'PLEIADE',definition:'Fratrie lumineuse issue d\'un unique embrasement, dont le nombre consacré dépasse d\'une unité le témoignage du regard — matrice de toutes les confréries d\'éclat, jusqu\'à cette bibliothèque de peau fine où l\'on inhume les œuvres qu\'on estime achevées.',secteur:'rayon'},
    {reponse:'DEFROISSEUR',definition:'Dispositif moderne qui ajuste les fréquences internes d\'une matière pour apaiser les tensions invisibles entre ses états, sans jamais intervenir physiquement.',secteur:'rayon'},
    {reponse:'DIAPHRAGME',definition:'Module orbiculaire à rétraction polyphasique, saturé d\'un bruit électro-spectral, qui contracte un interstice d\'éclat pour dériver la densité du visible comme un mécanisme optico-analogique en dérive temporelle.',secteur:'rayon'}
  ];
  function htmlToutesReponses() {
    var p1Rows = REF_P1.map(function(m,i){ return '<tr><td class=\"small\">'+(i+1)+'</td><td><b>'+esc(m.w)+'</b></td><td class=\"small\">'+esc(m.h)+'</td></tr>'; }).join('');
    var p2Rows = REF_P2.map(function(m,i){ return '<tr><td class=\"small\">'+(i+1)+'</td><td><b>'+esc(m.reponse)+'</b></td><td class=\"small\">'+esc(m.secteur)+'</td><td class=\"small\">'+esc(m.definition)+'</td></tr>'; }).join('');
    return ''
    + '<div class=\"adm-af-sec\" id=\"afToutesReponses\">'
    +   '<h4>📚 Tous les mini-jeux — bonnes réponses attendues</h4>'
    +   '<p class=\"small\">Référentiel <b>statique</b> (ne dépend pas d’une session) — visible dès que la phrase est déverrouillée. Complète la section Palier 3 ci-dessous qui, elle, dépend de la cartouche attribuée.</p>'
    +   '<details open style=\"margin:8px 0;padding:8px;border:1px solid #dfe8ee;border-radius:8px;background:#fbfdff\">'
    +     '<summary style=\"cursor:pointer;font-weight:800\">Palier 1 — Signal morse · 40 mots possibles (1 par équipage, tiré via <code>morseWordHash</code>)</summary>'
    +     '<p class=\"small\" style=\"margin:6px 0\">Chaque équipage a <b>son</b> mot fixe (assigné une seule fois, conservé en <code>teams/{code}.morseWordHash</code>). L’indice nº2 donne le nombre de lettres, le nº3 la première lettre.</p>'
    +     '<div style=\"max-height:220px;overflow:auto;border:1px solid #eef3f7;border-radius:6px\">'
    +       '<table class=\"adm-af-table\" style=\"width:100%\"><thead><tr><th>#</th><th>Réponse attendue</th><th>Indice thématique</th></tr></thead><tbody>'+p1Rows+'</tbody></table>'
    +     '</div>'
    +     '<p class=\"small\" style=\"margin-top:6px\">🔍 Mot de l’équipage sélectionné : <span id=\"afP1MotEquipe\" class=\"small\" style=\"font-weight:700\">— choisir un équipage ci-dessous puis « Voir les réponses » (Palier 3) pour voir le hash résolu —</span></p>'
    +   '</details>'
    +   '<details open style=\"margin:8px 0;padding:8px;border:1px solid #dfe8ee;border-radius:8px;background:#fbfdff\">'
    +     '<summary style=\"cursor:pointer;font-weight:800\">Palier 2 — Mots croisés · 11 mots (grille commune)</summary>'
    +     '<p class=\"small\" style=\"margin:6px 0\">Grille unique (<code>1721310619.html</code>) — tous les équipages cherchent les mêmes 11 mots. Secteur = rayon/caisse/stock/sav.</p>'
    +     '<div style=\"max-height:260px;overflow:auto;border:1px solid #eef3f7;border-radius:6px\">'
    +       '<table class=\"adm-af-table\" style=\"width:100%\"><thead><tr><th>#</th><th>Réponse attendue</th><th>Secteur</th><th>Définition affichée aux matelots</th></tr></thead><tbody>'+p2Rows+'</tbody></table>'
    +     '</div>'
    +   '</details>'
    +   '<details style=\"margin:8px 0;padding:8px;border:1px solid #dfe8ee;border-radius:8px;background:#fbfdff\">'
    +     '<summary style=\"cursor:pointer;font-weight:800\">Palier 3 — Artefact (4 étapes) — réponses par cartouche</summary>'
    +     '<p class=\"small\" style=\"margin:6px 0\">4 étapes : hublot/EAN, couverture/premier mot, signature, chambre forte. La cartouche est tirée au sort parmi le catalogue du <b>magasin</b> choisi — voir « Sessions en cours » et « Cartouches » ci-dessous.</p>'
    +   '</details>'
    + '</div>';
  }

  function HTML_REP() {
    return ''
    + '<p class="small" style="margin-bottom:10px">Affiche les <b>bonnes réponses attendues</b> pour les mini-jeux du Palier 3 (4 étapes : hublot/EAN, couverture/premier mot, signature, chambre forte). Accès réservé — phrase d’administration requise. Les réponses ne sont jamais stockées en clair.</p>'
    + '<!-- Affiche les **bonnes réponses attendues** pour les mini-jeux -->'
    + htmlToutesReponses()
    + '<div class="adm-af-sec">'
    +   '<h4>🔑 Déverrouiller les réponses</h4>'
    +   '<div class="adm-af-ligne">'
    +     '<input id="afRepPhrase" class="adm-af-input" type="password" placeholder="Phrase d’administration (8+ caractères)" style="flex:1;min-width:220px" autocomplete="off">'
    +     '<button id="afRepUnlock" class="primary" type="button">🔓 Déverrouiller</button>'
    +     '<button id="afRepLock" class="secondary" type="button">🔒 Verrouiller</button>'
    +   '</div>'
    +   '<p class="adm-af-note" id="afRepPhraseMsg"></p>'
    +   '<p class="adm-af-note" style="margin-top:4px">La phrase n’est jamais écrite dans localStorage ; elle est effacée en quittant la page.</p>'
    + '</div>'
    + '<div class="adm-af-sec">'
    +   '<h4>🔑 Réponses — marquer et voir</h4>'
    +   '<p class="small">Marquer et voir les 🔑 Réponses</p>'
    +   '<h4>📜 Sessions en cours — réponses attendues</h4>'
    +   '<div class="adm-af-ligne">'
    +     '<button id="afRepRefresh" class="secondary" type="button">↻ Lister les équipages</button>'
    +     '<select id="afRepEquipe" class="adm-af-select" style="flex:1;min-width:180px"><option value="">— choisir un équipage —</option></select>'
    +     '<button id="afRepVoir" class="primary" type="button">👁️ Voir les réponses</button>'
    +   '</div>'
    +   '<p class="adm-af-note" id="afRepEtat">Verrouille d’abord avec la phrase d’administration.</p>'
    +   '<div id="afRepBox" style="margin-top:8px"></div>'
    + '</div>'
    + '<div class="adm-af-sec">'
    +   '<h4>📦 Cartouches — aperçu hors session</h4>'
    +   '<p class="adm-af-note">Liste les cartouches générées pour un magasin (publiques : empreintes ; réponses en clair uniquement via coffre déchiffré).</p>'
    +   '<div class="adm-af-ligne">'
    +     '<input id="afRepMagasin" class="adm-af-input" placeholder="magasinId — ex. cl57" style="max-width:140px">'
    +     '<button id="afRepCartouches" class="secondary" type="button">📋 Lister les cartouches</button>'
    +   '</div>'
    +   '<div id="afRepCartBox" style="margin-top:8px"></div>'
    + '</div>'
    + '<div class="adm-af-sec" id="afNotesSec">'
    +   '<h4>Notes Mots recherches - par equipage</h4>'
    +   '<p class="small">Notes manuelles du capitaine pour suivre ce que chaque equipage <b>cherche en rayon</b> (sauvegardees sur cet appareil).</p>'
    +   '<div class="adm-af-ligne">'
    +     '<select id="afNotesEquipe" class="adm-af-select" style="min-width:140px"><option value="">- equipe -</option><option value="NEMO">NEMO</option><option value="NAUTILUS">NAUTILUS</option><option value="ARONNAX">ARONNAX</option><option value="NEDLAND">NEDLAND</option></select>'
    +     '<button id="afNotesCharger" class="secondary" type="button">Charger</button>'
    +     '<button id="afNotesSauver" class="primary" type="button">Enregistrer</button>'
    +     '<button id="afNotesExporter" class="secondary" type="button">Exporter JSON</button>'
    +   '</div>'
    +   '<textarea id="afNotesTexte" class="adm-af-input" rows="4" style="width:100%;margin-top:8px" placeholder="Ex. P1=BALEINES P2=STEELBOOK P3 Atlas EAN"></textarea>'
    +   '<p class="small" id="afNotesMsg" style="margin-top:4px"></p>'
    +   '<div id="afNotesListe" style="margin-top:8px"></div>'
    + '</div>';
  }

  function injecter() {
    ensureTabsCss();
    if (_monte) return;
    var workspace = $('adminWorkspace');
    if (!workspace) return;
    var tabs = workspace.querySelector('.admin-tabs');
    if (!tabs) return;
    // évite double injection
    if (workspace.querySelector('[data-pane="' + ONGLET_MAG + '"]') || workspace.querySelector('[data-pane="' + ONGLET_REP + '"]')) {
      if (workspace.querySelector('[data-pane="' + ONGLET_MAG + '"]')) { _monte = true; brancher(); }
      return;
    }
    // --- bouton Magasins
    var btnMag = document.createElement('button');
    btnMag.className = 'admin-tab';
    btnMag.type = 'button';
    btnMag.setAttribute('role', 'tab');
    btnMag.dataset.tab = ONGLET_MAG;
    btnMag.innerHTML = '<span class="lbl-desktop">🏪 Magasins</span><span class="lbl-mobile" aria-label="Magasins">🏪</span>';
    // --- bouton Réponses
    var btnRep = document.createElement('button');
    btnRep.className = 'admin-tab';
    btnRep.type = 'button';
    btnRep.setAttribute('role', 'tab');
    btnRep.dataset.tab = ONGLET_REP;
    btnRep.innerHTML = '<span class="lbl-desktop">🔑 Réponses</span><span class="lbl-mobile" aria-label="Réponses">🔑</span>';

    var danger = tabs.querySelector('[data-tab="danger"]'); // data-tab="danger"
    if (danger) {
      tabs.insertBefore(btnRep, danger);
      tabs.insertBefore(btnMag, btnRep);
    } else {
      tabs.appendChild(btnMag);
      tabs.appendChild(btnRep);
    }

    var paneMag = document.createElement('div');
    paneMag.className = 'admin-pane';
    paneMag.dataset.pane = ONGLET_MAG;
    paneMag.style.display = 'none';
    paneMag.innerHTML = HTML_MAG();
    workspace.appendChild(paneMag);

    var paneRep = document.createElement('div');
    paneRep.className = 'admin-pane';
    paneRep.dataset.pane = ONGLET_REP;
    paneRep.style.display = 'none';
    paneRep.innerHTML = HTML_REP();
    workspace.appendChild(paneRep);

    _monte = true;
    brancher();
  }

  function activerOnglet(onglet) {
    var target = onglet || ONGLET_MAG;
    document.querySelectorAll('.admin-tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === target);
    });
    document.querySelectorAll('.admin-pane').forEach(function (p) {
      p.style.display = (p.dataset.pane === target ? '' : 'none');
    });
    if (target === ONGLET_MAG) charger(false);
    if (target === ONGLET_REP) refreshEquipes();
  }

  function brancher() {
    var bMag = document.querySelector('.admin-tab[data-tab="' + ONGLET_MAG + '"]');
    if (bMag) bMag.addEventListener('click', function(){ activerOnglet(ONGLET_MAG); });
    var bRep = document.querySelector('.admin-tab[data-tab="' + ONGLET_REP + '"]');
    if (bRep) bRep.addEventListener('click', function(){ activerOnglet(ONGLET_REP); });

    // --- Magasins
    var r = $('afMagReload'); if (r) r.addEventListener('click', function(){ charger(true); });
    var v = $('afMagVerifier'); if (v) v.addEventListener('click', verifier);
    var p = $('afMagPublier'); if (p) p.addEventListener('click', publier);
    var e = $('afMagExporter'); if (e) e.addEventListener('click', exporter);
    var s = $('afMagSearch'); if (s) s.addEventListener('input', function(){ _filtre = (s.value||'').toLowerCase().trim(); rendreMag(); });
    var a = $('afMagAjouter'); if (a) a.addEventListener('click', ajouterOuMaj);
    var cl = $('afMagVider'); if (cl) cl.addEventListener('click', viderForm);

    // --- Réponses
    var rp = $('afRepPhrase'); if (rp) rp.addEventListener('input', function(){ _phrase = rp.value || ''; });
    var u = $('afRepUnlock'); if (u) u.addEventListener('click', unlockPhrase);
    var lk = $('afRepLock'); if (lk) lk.addEventListener('click', lockPhrase);
    var rf = $('afRepRefresh'); if (rf) rf.addEventListener('click', refreshEquipes);
    var vr = $('afRepVoir'); if (vr) vr.addEventListener('click', voirReponses);
    var lc = $('afRepCartouches'); if (lc) lc.addEventListener('click', listerCartouches);
    // --- Notes mots recherches
    var nc = $('afNotesCharger'); if (nc) nc.addEventListener('click', notesCharger);
    var ns = $('afNotesSauver'); if (ns) ns.addEventListener('click', notesSauver);
    var ne = $('afNotesExporter'); if (ne) ne.addEventListener('click', notesExporter);
    // copie EAN deleguee (bouton dans renduReponses)
    document.addEventListener('click', function(ev){
      var t=ev.target;
      if(t && t.getAttribute && t.getAttribute('data-copy-ean')){
        var v=t.getAttribute('data-copy-ean');
        if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(function(){ dire('afRepEtat','EAN copie : '+v,'ok'); }).catch(function(){ prompt('EAN a copier :', v); });
        else prompt('EAN a copier :', v);
      }
    });
    // init liste notes
    try{ notesRendreListe(); }catch(e){}
    window.addEventListener('beforeunload', function(){ _phrase = ''; var el=$('afRepPhrase'); if(el) el.value=''; });
  }

  // ===================== NOTES Mots recherches =====================
  var NOTES_CLE = 'nautilusNotesMotsRecherches';
  function notesLireTout(){
    try{ var j=JSON.parse(localStorage.getItem(NOTES_CLE)||'{}'); return (j && typeof j==='object')? j : {}; }catch(e){ return {}; }
  }
  function notesEcrireTout(o){
    try{ localStorage.setItem(NOTES_CLE, JSON.stringify(o)); return true; }catch(e){ return false; }
  }
  function notesCharger(){
    var eq=($('afNotesEquipe').value||'').trim();
    if(!eq){ dire('afNotesMsg','Choisis une equipe.','warn'); return; }
    var tout=notesLireTout();
    var txt=tout[eq]||'';
    var ta=$('afNotesTexte'); if(ta) ta.value=txt;
    dire('afNotesMsg', txt? 'Charge : '+eq : 'Aucune note pour '+eq+'.','');
    notesRendreListe();
  }
  function notesSauver(){
    var eq=($('afNotesEquipe').value||'').trim();
    if(!eq){ dire('afNotesMsg','Choisis une equipe.','warn'); return; }
    var txt=($('afNotesTexte').value||'');
    var tout=notesLireTout();
    if(txt) tout[eq]=txt; else delete tout[eq];
    notesEcrireTout(tout);
    dire('afNotesMsg','Enregistre pour '+eq+'.','ok');
    notesRendreListe();
  }
  function notesExporter(){
    var tout=notesLireTout();
    if(!Object.keys(tout).length){ dire('afNotesMsg','Aucune note a exporter.','warn'); return; }
    var blob=new Blob([JSON.stringify(tout,null,2)],{type:'application/json'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download='mots-recherches-notes-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1200);
    dire('afNotesMsg','Export telecharge.','ok');
  }
  function notesRendreListe(){
    var el=$('afNotesListe'); if(!el) return;
    var tout=notesLireTout();
    var keys=Object.keys(tout);
    if(!keys.length){ el.innerHTML='<p class="small" style="color:#6e7a84">Aucune note enregistree sur cet appareil.</p>'; return; }
    var html='<table class="adm-af-table" style="width:100%"><thead><tr><th>Equipe</th><th>Note</th></tr></thead><tbody>'
      + keys.sort().map(function(k){ return '<tr><td><b>'+esc(k)+'</b></td><td class="small" style="white-space:pre-wrap">'+esc(tout[k])+'</td></tr>'; }).join('')
      + '</tbody></table>';
    el.innerHTML=html;
  }

  // ===================== MAGASINS =====================
  function majLast() {
    var el = $('afMagLast');
    if (!el || !_liste) return;
    var dt = fmtDate(_liste.syncedAt);
    var badge = fmtSource(_liste.source, _liste.sourceType);
    var note = _liste.note ? '<br><span class="small" style="color:#6e7a84">' + esc(_liste.note) + '</span>' : '';
    el.innerHTML = '<b>Dernière mise à jour :</b> ' + dt + ' ' + badge + ' <span class="small" style="color:#6e7a84">(' + esc(age(_liste.syncedAt)) + ')</span><br>'
      + '<span class="small">Version <code>' + esc(_liste.version||'?') + '</code> — <b>' + (_liste.magasins ? _liste.magasins.length : 0) + '</b> magasins actifs · Source : <code>' + esc(_liste.source||'?') + '</code></span>' + note;
  }

  function charger(forcer) {
    if (!MG()) { dire('afMagEtat','❌ magasin-fnac.js non chargé.','danger'); return Promise.resolve(null); }
    dire('afMagEtat','⏳ Chargement…','');
    return MG().chargerListe({ forcer: !!forcer }).then(function(liste){
      _liste = liste;
      dire('afMagEtat','<b>' + esc(liste.version||'?') + '</b> — <b>' + liste.magasins.length + '</b> magasins actifs','ok');
      majLast();
      rendreMag();
      return liste;
    }).catch(function(e){
      dire('afMagEtat','❌ ' + esc(e && e.message || e),'danger');
      return null;
    });
  }

  function verifier() {
    if (!_liste) { dire('afMagMsg','Charge d’abord la liste.','warn'); return; }
    var prob = M() && M().controlerMagasins ? M().controlerMagasins(_liste.magasins, []) : [];
    var actifs = M() && M().magasinsUtilisables ? M().magasinsUtilisables(_liste.magasins).length : _liste.magasins.length;
    if (prob.length) dire('afMagMsg','❌ ' + prob.length + ' problème(s) : ' + esc(prob.slice(0,4).join(' ; ')),'danger');
    else dire('afMagMsg','✅ ' + actifs + ' actif(s), 0 doublon.','ok');
  }

  function publier() {
    if (!_liste) { dire('afMagMsg','Rien à publier.','warn'); return; }
    if (!S() || !S().publierMagasins) { dire('afMagMsg','Publication Firestore indisponible sur cette page.','warn'); return; }
    dire('afMagMsg','⏳ Publication…','');
    S().publierMagasins(_liste).then(function(doc){
      dire('afMagMsg','📤 Publiée : <b>' + esc(doc.version) + '</b> (' + doc.count + ' magasins). Active immédiatement pour les joueurs.','ok');
      _liste.version = doc.version; _liste.syncedAt = doc.syncedAt; _liste.source = doc.source; _liste.sourceType = 'panneau-admin';
      majLast();
    }).catch(function(e){ dire('afMagMsg','❌ ' + esc(e && e.message||e),'danger'); });
  }

  function exporter() {
    if (!_liste || !_liste.magasins || !_liste.magasins.length) { dire('afMagMsg','Rien à exporter.','warn'); return; }
    var doc = { version: _liste.version, source: _liste.source, sourceType: _liste.sourceType||'admin-manuel', syncedAt: new Date().toISOString(), count: _liste.magasins.length, magasins: _liste.magasins };
    var blob = new Blob([JSON.stringify(doc,null,2)], {type:'application/json'});
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'magasins-fnac-' + doc.version + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1200);
    dire('afMagMsg','⬇️ Export téléchargé — commit le fichier dans <code>data/magasins-fnac.json</code>.','ok');
  }

  function filtreListe() {
    if (!_liste || !_liste.magasins) return [];
    if (!_filtre) return _liste.magasins;
    return _liste.magasins.filter(function(m){
      var hay = (m.id+' '+m.nom+' '+m.ville+' '+m.cp).toLowerCase();
      return hay.indexOf(_filtre) >= 0;
    });
  }

  function rendreMag() {
    var hote = $('afMagTable'); var count = $('afMagCount');
    if (!hote || !_liste) return;
    var arr = filtreListe();
    if (count) count.textContent = arr.length + ' / ' + _liste.magasins.length;
    if (!arr.length) { hote.innerHTML = '<p class="adm-af-note" style="padding:10px">Aucun magasin.</p>'; return; }
    var html = '<table class="adm-af-table" style="width:100%"><thead><tr><th>id</th><th>Nom — ville (CP)</th><th>lat/lon</th><th></th></tr></thead><tbody>'
      + arr.map(function(m){
        return '<tr>'
          + '<td><code>' + esc(m.id||'—') + '</code>' + (m.actif===false?'<br><span class="adm-af-badge adm-af-badge--warn">inactif</span>':'') + '</td>'
          + '<td><b>' + esc(m.nom||'?') + '</b><br><span class="small">' + esc(m.ville||'—') + ' ' + esc(m.cp||'') + '</span><br><span class="small">' + esc(m.slug||'') + '</span></td>'
          + '<td class="small">' + esc(m.lat!=null?String(m.lat):'—') + '<br>' + esc(m.lon!=null?String(m.lon):'—') + '</td>'
          + '<td style="white-space:nowrap"><button class="secondary adm-af-mini" data-mag-edit="' + esc(m.id) + '" type="button">✏️</button> <button class="danger adm-af-mini" data-mag-del="' + esc(m.id) + '" type="button">🗑️</button></td>'
          + '</tr>';
      }).join('') + '</tbody></table>';
    hote.innerHTML = html;
    hote.querySelectorAll('[data-mag-edit]').forEach(function(b){
      b.addEventListener('click', function(){
        var id = b.dataset.magEdit;
        var m = _liste.magasins.filter(function(x){ return x.id===id; })[0];
        if (!m) return;
        $('afMagId').value = m.id||'';
        $('afMagNom').value = m.nom||'';
        $('afMagVille').value = m.ville||'';
        $('afMagCp').value = m.cp||'';
        $('afMagLat').value = m.lat!=null? m.lat : '';
        $('afMagLon').value = m.lon!=null? m.lon : '';
        $('afMagSlug').value = m.slug||'';
        dire('afMagFormMsg','✏️ Édition : '+esc(m.nom),'');
        $('afMagId').scrollIntoView({behavior:'smooth', block:'center'});
      });
    });
    hote.querySelectorAll('[data-mag-del]').forEach(function(b){
      b.addEventListener('click', function(){
        var id = b.dataset.magDel;
        if (!confirm('Supprimer le magasin ' + id + ' ?')) return;
        _liste.magasins = _liste.magasins.filter(function(x){ return x.id!==id; });
        _liste.count = _liste.magasins.length;
        dire('afMagFormMsg','🗑️ Supprimé : '+esc(id)+' — pense à publier/exporter.','warn');
        majLast(); rendreMag();
      });
    });
  }

  function viderForm(){
    ['afMagId','afMagNom','afMagVille','afMagCp','afMagLat','afMagLon','afMagSlug'].forEach(function(i){ var el=$(i); if(el) el.value=''; });
    dire('afMagFormMsg','','');
  }
  function ajouterOuMaj(){
    var id = ($('afMagId').value||'').trim();
    var nom = ($('afMagNom').value||'').trim();
    if (!id || !nom) { dire('afMagFormMsg','❌ id et nom obligatoires.','danger'); return; }
    var ville = ($('afMagVille').value||'').trim();
    var cp = ($('afMagCp').value||'').trim().replace(/[^0-9]/g,'');
    var latS = ($('afMagLat').value||'').trim(); var lat = latS? Number(latS): undefined;
    var lonS = ($('afMagLon').value||'').trim(); var lon = lonS? Number(lonS): undefined;
    var slug = ($('afMagSlug').value||'').trim();
    var fiche = { id:id, nom:nom, ville:ville, cp:cp, slug:slug };
    if (lat!=null && isFinite(lat)) fiche.lat = lat;
    if (lon!=null && isFinite(lon)) fiche.lon = lon;
    if (MG() && MG().normaliserMagasin) {
      var n = MG().normaliserMagasin(fiche);
      if (!n) { dire('afMagFormMsg','❌ Fiche invalide.','danger'); return; }
      fiche = n;
    }
    if (!_liste) { dire('afMagFormMsg','Charge d’abord la liste.','warn'); return; }
    var idx = -1; for(var i=0;i<_liste.magasins.length;i++) if(_liste.magasins[i].id===id) idx=i;
    if (idx>=0) { _liste.magasins[idx] = Object.assign({}, _liste.magasins[idx], fiche); dire('afMagFormMsg','✅ Mis à jour : '+esc(nom),'ok'); }
    else { _liste.magasins.push(fiche); _liste.count = _liste.magasins.length; dire('afMagFormMsg','✅ Ajouté : '+esc(nom),'ok'); }
    majLast(); rendreMag();
  }

  // ===================== RÉPONSES =====================
  function unlockPhrase(){
    var v = ($('afRepPhrase').value||'');
    if (v.length < 8) { dire('afRepPhraseMsg','❌ 8 caractères minimum.','danger'); return; }
    _phrase = v;
    dire('afRepPhraseMsg','✅ Phrase acceptée — présente dans le code public, elle ne protège rien seule ; la sécurité réelle est la <b>phrase d’administration</b> longue utilisée pour chiffrer le catalogue.','ok');
    dire('afRepEtat','✅ Déverrouillé — liste les équipages pour voir les réponses.','ok');
    refreshEquipes();
  }
  function lockPhrase(){
    _phrase = '';
    var el=$('afRepPhrase'); if(el) el.value='';
    dire('afRepPhraseMsg','🔒 Verrouillé — phrase effacée.','');
    dire('afRepEtat','Verrouille d’abord avec la phrase d’administration.','');
    $('afRepBox').innerHTML='';
  }

  function refreshEquipes(){
    var sel = $('afRepEquipe');
    if (!sel) return;
    if (!_phrase) { dire('afRepEtat','🔒 Entre la phrase d’administration pour lister les équipages.','warn'); return; }
    if (!S() || !S().stockage) { dire('afRepEtat','Service artefact non chargé.','warn'); return; }
    dire('afRepEtat','⏳ Chargement des équipages…','');
    // On liste via Firestore si dispo, sinon via Teams connus
    var equipesConnues = ['NEMO','NAUTILUS','ARONNAX','NEDLAND'];
    try {
      var raw = localStorage.getItem('nautilusTeamsList');
      if (raw) { var j=JSON.parse(raw); if(Array.isArray(j) && j.length) equipesConnues=j; }
    } catch(e){}
    // Essaie de lire les sessions directement
    var p = S().stockage().lister(S().CHEMINS.sessions).then(function(docs){
      var codes = docs.map(function(d){ return d._id || d.equipe; }).filter(Boolean);
      if (!codes.length) codes = equipesConnues;
      sel.innerHTML = '<option value="">— choisir —</option>' + codes.map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join('');
      dire('afRepEtat','✅ ' + codes.length + ' session(s) trouvée(s). Choisis un équipage puis « Voir les réponses ».','ok');
    }).catch(function(e){
      // fallback : propose les 4 équipes par défaut
      sel.innerHTML = '<option value="">— choisir —</option>' + equipesConnues.map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join('');
      dire('afRepEtat','ℹ️ Liste des sessions non lisible ('+esc(e.message||e)+') — sélection manuelle proposée.','warn');
    });
    return p;
  }

  function voirReponses(){
    var eq = ($('afRepEquipe').value||'').trim();
    if (!eq) { dire('afRepEtat','Choisis un équipage.','warn'); return; }
    if (!_phrase) { dire('afRepEtat','🔒 Déverrouille d’abord avec la phrase.','warn'); return; }
    if (!_phrase || _phrase.length < 8) { dire('afRepEtat','❌ Phrase trop courte (8+).','danger'); return; }
    dire('afRepEtat','⏳ Lecture de la session ' + esc(eq) + '…','');
    var box = $('afRepBox'); if (!box) return;
    box.innerHTML = '<p class="adm-af-note">Chargement…</p>';

    S().lireSession(eq).then(function(sess){
      if (!sess || !sess.cartouche) {
        box.innerHTML = '<p class="adm-af-note" style="color:#9b1111">Aucune session active pour <b>'+esc(eq)+'</b> (statut: '+esc(sess? sess.statut : 'introuvable')+').</p>';
        dire('afRepEtat','Aucune mission en cours pour '+esc(eq)+'.','warn');
        return;
      }
      var cart = sess.cartouche;
      var cid = sess.cartoucheId || cart.id;
      // Essaie de déchiffrer le coffre pour obtenir les réponses en clair
      S().lireCoffre(cid, _phrase).then(function(secret){
        rendreReponses(box, eq, sess, cart, secret);
        dire('afRepEtat','✅ Réponses pour <b>'+esc(eq)+'</b> — cartouche <code>'+esc(cid)+'</code>','ok');
      }).catch(function(e){
        // Coffre absent (aperçu sans phrase) : on affiche au moins les empreintes / indices publics
        rendreReponses(box, eq, sess, cart, null, e && e.message);
      });
    }).catch(function(e){
      box.innerHTML = '<p class="adm-af-note" style="color:#9b1111">❌ '+esc(e.message||e)+'</p>';
      dire('afRepEtat','❌ Lecture impossible.','danger');
    });
  }

  function rendreReponses(box, equipe, sess, cart, secret, errDec){
    var eta = cart.etapes || [];
    var hist = (sess.historique||[]).slice(-10).map(function(h){ var t=esc(h.texte||h.type||''); if(h.essai) t+=' <code style="background:#fff3cd;padding:1px 4px;border-radius:4px">'+esc(h.essai)+'</code>'; return '<li><span class="small" style="color:#6e7a84">'+esc((h.le||'').slice(11,16)||'')+'</span> — '+t+' <span class="small" style="color:#888">['+esc(h.type||'')+']</span></li>'; }).join('');
    var html = ''
    + '<div style="border:1px solid #dfe8ee;border-radius:8px;padding:10px;background:#fbfdff;margin-bottom:8px">'
    +   '<b>Équipage '+esc(equipe)+'</b> — magasin <code>'+esc(sess.magasinId||'?')+'</code> — session <b>'+esc(sess.statut||'?')+'</b><br>'
    +   '<span class="small">Cartouche <code>'+esc(cart.id||'')+'</code> · famille <code>'+esc(cart.famille||'')+'</code> · générée le '+esc(cart.genereLe||'')+'</span><br>'
    +   '<span class="small">Progression : '+(sess.etapesValidees||[]).length+'/'+eta.length+' validées · erreurs '+esc(String(sess.erreurs||0))+'</span>'
    + '</div>';

    if (secret && secret.reponses) {
      var r = secret.reponses;
      var livre = secret.livre || {};
      // En-tête livre ultra-visible : nom + EAN demandés par le capitaine
      html += '<div style="border:2px solid #0b6b4a;border-radius:10px;padding:12px;background:#eefaf4;margin-bottom:10px">'
        +   '<div style="font-weight:900;font-size:14px;color:#0b4a3a;letter-spacing:.02em">📖 Livre du Palier 3 — nom & EAN à chercher en rayon</div>'
        +   '<div style="font-size:16px;margin:8px 0 6px 0"><b>'+esc(livre.titre||'?')+'</b> — '+esc(livre.auteur||'—')+' <span class="small">('+esc(livre.editeur||'')+')</span></div>'
        +   '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">'
        +     '<span style="font-family:monospace;font-size:15px;background:#fff;border:1px solid #bfe7d2;border-radius:6px;padding:6px 10px">EAN : <b>'+esc(r.ean||'?')+'</b></span>'
        +     '<button type="button" class="secondary adm-af-mini" data-copy-ean="'+esc(r.ean||'')+'" style="padding:6px 10px">📋 Copier l’EAN</button>'
        +     '<span class="small" style="align-self:center">SKU '+esc(livre.sku||'—')+' · '+(livre.edition? esc(livre.edition)+' · ' : '')+esc(livre.annee||'')+'</span>'
        +   '</div>'
        +   '<p class="small" style="margin:6px 0 0 0;color:#2a6b4a">À dicter aux équipages : titre exact + EAN 13 chiffres. Le code-barres doit être scanné au hublot.</p>'
        + '</div>';
      html += '<table class="adm-af-table"><thead><tr><th>Étape</th><th>Bonne réponse attendue</th></tr></thead><tbody>'
        + '<tr><td><b>1. Hublot</b><br><span class="small">scan EAN</span></td><td><code>'+esc(r.ean||'?')+'</code><br><span class="small">'+esc((secret.livre&&secret.livre.titre)||'')+'</span></td></tr>'
        + '<tr><td><b>2. Couverture</b><br><span class="small">premier mot significatif</span></td><td><b>'+esc(r.premierMot||'?')+'</b></td></tr>'
        + '<tr><td><b>3. Signature</b><br><span class="small">règle '+esc(secret.regle||'')+' — '+esc((secret.regle && M() && M().regleParId? (M().regleParId(secret.regle)||{}).nom : '')||'')+'</span></td><td><code>'+esc(r.signature||'?')+'</code></td></tr>'
        + '<tr><td><b>4. Chambre forte</b><br><span class="small">ordre '+esc(secret.ordre||'')+'</span></td><td><code>'+esc(r.codeFinal||'?')+'</code></td></tr>'
        + '</tbody></table>'
        + '<p class="adm-af-note" style="color:#9b1111">⚠️ Ne JAMAIS déposer ce fichier dans le dépôt (<code>data/*.local.json</code> est ignoré). Exporter uniquement via <code>nautilus-safe/</code>.</p>';
    } else {
      html += '<p class="adm-af-note" style="color:#9b1111">🔒 Coffre non déchiffré'+(errDec? ' : '+esc(errDec):'')+' — vérifie la phrase d’administration.</p>'
        + '<p class="adm-af-note">Indices publics de la cartouche :</p>'
        + '<p class="adm-af-note" style="white-space:pre-wrap;background:#fff;border:1px solid #eef3f7;border-radius:6px;padding:8px">'+esc(cart.indice||'')+'</p>';
      if (eta.length) {
        html += '<table class="adm-af-table"><thead><tr><th>Étape</th><th>Consigne / empreintes (hachées)</th></tr></thead><tbody>'
          + eta.map(function(e){ return '<tr><td><b>'+esc(e.id)+'</b><br><span class="small">'+esc(e.libelle||'')+'</span></td><td><span class="small" style="word-break:break-all">'+esc((e.empreintes||[]).slice(0,1).join('').slice(0,18)+'…')+'</span></td></tr>'; }).join('')
          + '</tbody></table>';
      }
    }
    if (hist) html += '<p class="adm-af-note"><b>Historique</b> (remplacements, indices) :</p><ul class="adm-af-hist">'+hist+'</ul>';
    // Actions admin rapides
    html += '<div class="adm-af-ligne" style="margin-top:10px">'
      + '<button class="secondary adm-af-mini" id="afRepTransmettre" type="button">📤 Transmettre indice en attente</button>'
      + '<button class="secondary adm-af-mini" id="afRepIndispo" type="button">🚫 Marquer cartouche indisponible</button>'
      + '<button class="danger adm-af-mini" id="afRepReset" type="button">🔄 Réinitialiser la session</button>'
      + '</div><p class="adm-af-note" id="afRepActionMsg"></p>';

    box.innerHTML = html;

    // branche les actions
    var bT = $('afRepTransmettre'); if(bT) bT.addEventListener('click', function(){ transmettreIndice(equipe, sess); });
    var bI = $('afRepIndispo'); if(bI) bI.addEventListener('click', function(){ marquerIndisponible(equipe, sess); });
    var bR = $('afRepReset'); if(bR) bR.addEventListener('click', function(){ resetSession(equipe); });
  }

  function transmettreIndice(equipe, sess){
    var rang = sess && sess.demandeIndice && sess.demandeIndice.rang;
    if (!rang) { dire('afRepActionMsg','Aucune demande d’indice en attente.','warn'); return; }
    var texte = prompt('Texte exact de l’indice à transmettre (rang '+rang+') :');
    if (!texte) return;
    S().transmettreIndice(equipe, rang, texte).then(function(){ dire('afRepActionMsg','✅ Indice transmis (rang '+rang+').','ok'); voirReponses(); })
      .catch(function(e){ dire('afRepActionMsg','❌ '+esc(e.message||e),'danger'); });
  }
  function marquerIndisponible(equipe, sess){
    var cid = sess && (sess.cartoucheId || (sess.cartouche&&sess.cartouche.id));
    if (!cid) { dire('afRepActionMsg','Cartouche inconnue.','warn'); return; }
    if (!confirm('Marquer la cartouche '+cid+' comme indisponible ? Elle ne sera plus proposée.')) return;
    S().marquerIndisponible(cid, 'signalé depuis panneau admin — réponses').then(function(){ dire('afRepActionMsg','🚫 Cartouche marquée indisponible.','ok'); })
      .catch(function(e){ dire('afRepActionMsg','❌ '+esc(e.message||e),'danger'); });
  }
  function resetSession(equipe){
    if (!confirm('Réinitialiser la session de '+equipe+' ? Progression, erreurs et indices effacés.')) return;
    S().reinitialiser(equipe, {par:'admin-reponses'}).then(function(){ dire('afRepActionMsg','🔄 Session réinitialisée.','ok'); voirReponses(); })
      .catch(function(e){ dire('afRepActionMsg','❌ '+esc(e.message||e),'danger'); });
  }

  function listerCartouches(){
    var mid = ($('afRepMagasin').value||'').trim();
    if (!mid) { $('afRepCartBox').innerHTML='<p class="adm-af-note" style="color:#9b1111">Renseigne un magasinId.</p>'; return; }
    if (!_phrase || _phrase.length < 8) { $('afRepCartBox').innerHTML='<p class="adm-af-note" style="color:#9b1111">Déverrouille d’abord avec la phrase.</p>'; return; }
    var box=$('afRepCartBox'); box.innerHTML='<p class="adm-af-note">Chargement…</p>';
    S().listerCartouches(mid).then(function(docs){
      if (!docs.length) { box.innerHTML='<p class="adm-af-note">Aucune cartouche pour '+esc(mid)+'.</p>'; return; }
      box.innerHTML = '<p class="adm-af-note">'+docs.length+' cartouche(s) pour <code>'+esc(mid)+'</code> (empreintes publiques — réponses via session ci-dessus).</p>'
        + '<table class="adm-af-table"><thead><tr><th>Cartouche</th><th>Famille</th><th>Générée le</th><th>Actions</th></tr></thead><tbody>'
        + docs.map(function(c){ return '<tr><td><code>'+esc(c.id||c._id)+'</code></td><td>'+esc(c.famille||'')+'</td><td class="small">'+esc(c.genereLe||'')+'</td><td><button class="secondary adm-af-mini" data-cart-voir="'+esc(c.id||c._id)+'" type="button">👁️ Réponses</button></td></tr>'; }).join('')
        + '</tbody></table>';
      box.querySelectorAll('[data-cart-voir]').forEach(function(b){
        b.addEventListener('click', function(){
          var cid=b.dataset.cartVoir;
          S().lireCoffre(cid, _phrase).then(function(sec){
            alert('Cartouche '+cid+'\n\nRéponses :\nEAN: '+(sec.reponses.ean||'')+'\nPremier mot: '+(sec.reponses.premierMot||'')+'\nSignature: '+(sec.reponses.signature||'')+'\nChambre forte: '+(sec.reponses.codeFinal||'')+'\n\nLivre: '+(sec.livre.titre||'')+' — '+(sec.livre.auteur||''));
          }).catch(function(e){ alert('❌ '+ (e.message||e)); });
        });
      });
    }).catch(function(e){ box.innerHTML='<p class="adm-af-note" style="color:#9b1111">❌ '+esc(e.message||e)+'</p>'; });
  }

  function observer(){
    ensureTabsCss();
    if ($('adminWorkspace')) { injecter(); return; }
    var mo = new MutationObserver(function(){ if($('adminWorkspace')){ injecter(); if(_monte) mo.disconnect(); }});
    try{ mo.observe(document.body||document.documentElement,{childList:true,subtree:true}); }catch(e){}
    // Polling fallback for iOS Safari where MutationObserver may miss injected admin panel
    var tries=0; var iv=setInterval(function(){ tries++; if($('adminWorkspace')){ injecter(); clearInterval(iv); } if(tries>15) clearInterval(iv); },800);
    setTimeout(injecter,800); setTimeout(injecter,2000); setTimeout(injecter,3500);
    window.addEventListener('load', function(){ setTimeout(injecter,300); });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', observer); else observer();

  window.NautilusAdminArtefact = {
    ONGLET_MAG: ONGLET_MAG, ONGLET_REP: ONGLET_REP, injecter: injecter, activerOnglet: activerOnglet,
    estMonte: function(){ return _monte; }
  };
})();
