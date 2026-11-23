/* =====================================================================
   admin-artefact.js — ONGLETS ADMIN « 🏪 Magasins » + « 🔑 Réponses » + « 📷 QR Codes »
   Remplace l'ancien onglet « Artefact » :

   1) 🏪 Magasins — mise à jour manuelle de la liste Fnac si l'automatisation
      n'a pas eu lieu. Affiche la date de dernière MAJ (auto/manuelle) et
      permet recharger / vérifier / publier / exporter.

   2) 🔑 Réponses — voir les bonnes réponses attendues des mini-jeux
      (4 étapes) pour chaque équipage.

   3) 📷 QR Codes — QR de déverrouillage des paliers 2→7 avec logo
      Nautilus au centre + téléchargement direct (noir/blanc + jaune/noir + planche).

   Injection légère dans le panneau admin existant (admin-button.js)
   ===================================================================== */
(function () {
  'use strict';
  if (window.NautilusAdminArtefact) return;

  var ONGLET_MAG = 'magasins';
  var ONGLET_REP = 'reponses';
  var ONGLET_QR  = 'qr';
  var _monte = false;
  var _liste = null;
  var _filtre = '';

  var CHIP_STYLE_DEFAULT = 'display:inline-flex;align-items:center;font-size:12px;font-weight:800;background:#03111f;color:#ffffff;border:1.5px solid rgba(142,231,255,0.38);border-radius:999px;padding:4px 10px;white-space:nowrap;flex:0 0 auto;box-shadow:0 2px 6px rgba(0,0,0,0.4);letter-spacing:.02em;line-height:1.3';
  var LBL_STYLE = 'display:inline-flex;align-items:center;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;background:rgba(142,231,255,0.18);color:#8ee7ff;border:1px solid rgba(142,231,255,0.45);border-radius:999px;padding:3px 9px;flex:0 0 auto;line-height:1.3';

  function ensureTabsCss(){
    var st = document.getElementById('nautilusAdminTabsFix');
    if(!st){
      st = document.createElement('style');
      st.id = 'nautilusAdminTabsFix';
      (document.head||document.documentElement).appendChild(st);
    }
    st.textContent='.admin-tabs{display:flex;flex-wrap:nowrap;gap:4px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:4px}.admin-tabs::-webkit-scrollbar{display:none}.admin-tab{flex:0 0 auto;white-space:nowrap;min-width:36px;justify-content:center}.admin-pane{min-width:0;overflow-wrap:anywhere;max-width:100%}#adminPanel .body{overflow-x:hidden}'
      + '.adm-af-cards{display:flex;flex-direction:column;gap:12px;padding:6px 2px 8px;overflow:visible}'
      + '#adminPanel .adm-af-teamcard,.adm-af-teamcard{flex:0 0 auto !important;width:100% !important;max-width:none !important;min-width:0 !important;background:rgba(4,18,32,0.92) !important;border:1px solid rgba(142,231,255,0.3) !important;border-radius:12px !important;padding:12px 14px !important;box-shadow:0 4px 16px rgba(0,0,0,.4) !important;color:#eaf8ff !important;box-sizing:border-box !important}'
      + '#adminPanel .adm-af-teamhead,.adm-af-teamhead{font-weight:900 !important;font-size:13px !important;letter-spacing:.05em !important;display:flex !important;align-items:center !important;justify-content:space-between !important;margin-bottom:8px !important;color:#ffd36c !important}'
      + '#adminPanel .adm-af-teamhead span:first-child,.adm-af-teamhead span:first-child{color:#ffd36c !important;font-weight:900 !important}'
      + '#adminPanel .adm-af-teamhead .small,.adm-af-teamhead .small{color:#9bc4d4 !important;font-weight:600 !important}'
      + '#adminPanel .adm-af-row,.adm-af-row{display:flex !important;align-items:center !important;gap:8px !important;margin:8px 0 !important;min-width:0 !important}'
      + '#adminPanel .adm-af-lbl,.adm-af-lbl{display:inline-flex !important;align-items:center !important;font-size:11px !important;font-weight:900 !important;letter-spacing:.08em !important;text-transform:uppercase !important;background:rgba(142,231,255,0.18) !important;color:#8ee7ff !important;border:1px solid rgba(142,231,255,0.45) !important;border-radius:999px !important;padding:3px 9px !important;flex:0 0 auto !important;box-shadow:0 1px 4px rgba(0,0,0,.3) !important;line-height:1.3 !important}'
      + '#adminPanel .adm-af-chip,.adm-af-chip{display:inline-flex !important;align-items:center !important;font-size:12px !important;font-weight:800 !important;background:#03111f !important;border:1.5px solid rgba(142,231,255,0.38) !important;border-radius:999px !important;padding:4px 10px !important;white-space:nowrap !important;flex:0 0 auto !important;color:#ffffff !important;box-shadow:0 2px 6px rgba(0,0,0,.4) !important;letter-spacing:.02em !important;transition:all .15s ease !important;line-height:1.3 !important}'
      + '#adminPanel .adm-af-chip:hover,.adm-af-chip:hover{background:rgba(142,231,255,0.18) !important;border-color:#8ee7ff !important;color:#ffffff !important}'
      + '#adminPanel .adm-af-chip--hl,.adm-af-chip--hl{background:rgba(46,213,115,0.22) !important;border-color:#2ed573 !important;color:#a8ffcc !important;font-weight:900 !important;box-shadow:0 0 10px rgba(46,213,115,0.45) !important}'
      + '#adminPanel .adm-af-chip--hl:hover,.adm-af-chip--hl:hover{background:rgba(46,213,115,0.32) !important;border-color:#5be09b !important;color:#ffffff !important}'
      + '#adminPanel .adm-af-chips,.adm-af-chips{display:flex !important;gap:6px !important;overflow-x:auto !important;overflow-y:hidden !important;align-items:center !important;-webkit-overflow-scrolling:touch !important;scrollbar-width:thin !important;scrollbar-color:rgba(142,231,255,0.3) transparent !important;flex:1 !important;min-width:0 !important;padding:2px 2px 4px !important}'
      + '#adminPanel .adm-af-chips::-webkit-scrollbar,.adm-af-chips::-webkit-scrollbar{height:4px !important}'
      + '#adminPanel .adm-af-chips::-webkit-scrollbar-thumb,.adm-af-chips::-webkit-scrollbar-thumb{background:rgba(142,231,255,0.3) !important;border-radius:4px !important}'
      + '#adminPanel .adm-af-ean,.adm-af-ean{font-family:Consolas,monospace !important;font-size:12px !important;background:#03111f !important;color:#ffd36c !important;border:1px solid rgba(142,231,255,0.3) !important;border-radius:6px !important;padding:3px 6px !important;letter-spacing:.02em !important}'
      + '@media(min-width:720px){.adm-af-cards{gap:14px}.adm-af-teamcard{padding:12px}}'
      + '.adm-qr-grid{display:grid;grid-template-columns:1fr;gap:14px;margin-top:10px}'
      + '#adminPanel .adm-qr-card,.adm-qr-card{background:rgba(4,18,32,0.92) !important;border:1px solid rgba(142,231,255,0.3) !important;border-radius:12px !important;padding:12px !important;box-shadow:0 4px 16px rgba(0,0,0,.4) !important;color:#eaf8ff !important}'
      + '#adminPanel .adm-qr-card h5,.adm-qr-card h5{margin:0 0 6px !important;font-size:13px !important;font-weight:900 !important;color:#ffd36c !important}'
      + '.adm-qr-imgs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}'
      + '#adminPanel .adm-qr-imgbox,.adm-qr-imgbox{background:#03111f !important;border:1px solid rgba(142,231,255,0.25) !important;border-radius:8px !important;padding:6px !important;text-align:center !important;color:#eaf8ff !important}'
      + '.adm-qr-imgbox img{width:100%;height:auto;display:block;border-radius:6px;background:#fff;padding:4px}'
      + '.adm-qr-dl{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}'
      + '.adm-qr-dl a{flex:1;min-width:110px;text-align:center;background:rgba(142,231,255,0.18);color:#8ee7ff;border:1px solid rgba(142,231,255,0.4);border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;text-decoration:none}'
      + '.adm-qr-dl a:nth-child(2){background:#f5b027;color:#0b1a2e;border:1px solid #f5b027}'
      + '@media(min-width:720px){.adm-qr-grid{grid-template-columns:1fr 1fr}}';
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
    el.style.color = kind === 'ok' ? '#5be09b' : kind === 'danger' ? '#ff8579' : kind === 'warn' ? '#ffd36c' : '#eaf8ff';
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
    + '<p class="small" style="margin-bottom:10px">Liste des <b>magasins Fnac</b>. Source : <code>data/magasins-fnac.json</code> (ou Firestore si publiée plus récemment).</p>'
    + '<div class="adm-af-sec">'
    +   '<h4>📍 Magasins — mise à jour</h4>'
    +   '<div id="afMagLast" class="adm-af-note" style="background:rgba(4,18,32,0.85);border:1px solid rgba(142,231,255,0.25);border-radius:8px;padding:8px 10px;margin-bottom:8px">Chargement…</div>'
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
    +   '<div id="afMagTable" style="margin-top:8px;max-height:360px;overflow:auto;border:1px solid rgba(142,231,255,0.25);border-radius:8px;background:rgba(3,17,31,0.9)"></div>'
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
    + '</div>';
  }


  // ── Référentiel minimal — 40 mots P1 + 11 mots P2
  var REF_P1 = [
    {w:'NAUTILE'},{w:'ABYSSES'},{w:'EPAVES'},{w:'EQUATEUR'},{w:'OCEANES'},{w:'RECIFAL'},{w:'SOUSMARIN'},{w:'BARQUES'},{w:'PHOQUES'},{w:'CETACES'},{w:'CORAIL'},{w:'MEDUSES'},{w:'OURSINS'},{w:'CRUSTACE'},{w:'BALEINES'},{w:'DAUPHINS'},{w:'REQUINS'},{w:'ANCHOIS'},{w:'SARDINES'},{w:'MOULES'},{w:'HUITRES'},{w:'CREVETTES'},{w:'LANGOUSTE'},{w:'MAREEES'},{w:'COURANTS'},{w:'VAGUES'},{w:'ECUMES'},{w:'ALGUES'},{w:'MANGROVE'},{w:'PROMENADE'},{w:'PHARE'},{w:'MARINIER'},{w:'PIRATES'},{w:'FLIBUSTIER'},{w:'EQUIPAGES'},{w:'MATELOTS'},{w:'CAPITAINE'},{w:'AMIRAUTE'},{w:'CHALUTIER'},{w:'SOUSMARINE'}
  ];
  var REF_P2 = ['STEELBOOK','ECOTAXE','PICKING','ANTISKATING','NEURONAL','RAYTRACING','REASSORT','REPRISE','PLEIADE','DEFROISSEUR','DIAPHRAGME'];
  var REF_P4 = [
    { s: 'NR', nom: 'Nautilus', c: 'G9' },
    { s: 'AB', nom: 'Abysses', c: 'I1' },
    { s: 'CR', nom: 'Corail', c: 'I5' },
    { s: 'KT', nom: 'Kraken', c: 'B3' },
    { s: 'PH', nom: 'Phare', c: 'A4' },
    { s: 'SN', nom: 'Sonar', c: 'E7' },
    { s: 'TR', nom: 'Trésor', c: 'I2' },
    { s: 'VL', nom: 'Voilier', c: 'C3' }
  ];
  var REF_P5 = [
    { nom: "Marshall Major IV", p: "150 €" },
    { nom: "JBL Flip 6", p: "140 €" },
    { nom: "Platine Audio-Technica", p: "180 €" },
    { nom: "Sony WF-C500", p: "80 €" },
    { nom: "Bose QC SC", p: "300 €" },
    { nom: "AirPods 3 MagSafe", p: "199 €" },
    { nom: "Sony WH-1000XM5", p: "420 €" },
    { nom: "Marshall Acton III", p: "280 €" },
    { nom: "JBL Go 3 Bleu", p: "45 €" },
    { nom: "Bose QC Earbuds II", p: "250 €" },
    { nom: "Barre de son JBL 2.0", p: "180 €" },
    { nom: "Sennheiser HD 560S", p: "170 €" },
    { nom: "Souris Logitech G502", p: "90 €" },
    { nom: "Clavier Logitech G915", p: "230 €" },
    { nom: "Apple iPad 10.9\"", p: "439 €" },
    { nom: "Logitech MX Master 3S", p: "130 €" },
    { nom: "Apple Pencil 2", p: "149 €" },
    { nom: "Logitech MX Keys Mini", p: "110 €" },
    { nom: "Disque Seagate 2 To", p: "85 €" },
    { nom: "Clé USB SanDisk 128 Go", p: "20 €" },
    { nom: "SSD Samsung T7 1 To", p: "120 €" },
    { nom: "Casque Jabra Evolve 20", p: "50 €" },
    { nom: "Écran Dell 24\" FHD", p: "130 €" },
    { nom: "Imprimante Canon TS5350a", p: "80 €" },
    { nom: "Garmin Forerunner 55", p: "200 €" },
    { nom: "Apple Watch SE 40mm", p: "279 €" },
    { nom: "Batterie Anker 10000 mAh", p: "30 €" },
    { nom: "Chargeur Belkin Qi 15W", p: "35 €" },
    { nom: "Coque iPhone 15 MagSafe", p: "59 €" },
    { nom: "Apple AirTag", p: "39 €" },
    { nom: "Galaxy Watch 6 40mm", p: "320 €" },
    { nom: "Câble Apple USB-C/Lightning", p: "25 €" },
    { nom: "Xiaomi Smart Band 8", p: "40 €" },
    { nom: "Perche Joby GripTight", p: "35 €" },
    { nom: "Manette Xbox Series", p: "60 €" },
    { nom: "Casque HyperX Cloud II", p: "100 €" },
    { nom: "Manette PS5 DualSense", p: "75 €" },
    { nom: "Nintendo Switch OLED", p: "320 €" },
    { nom: "Zelda: Tears of the Kingdom", p: "70 €" },
    { nom: "Super Mario Bros. Wonder", p: "60 €" },
    { nom: "Spider-Man 2 PS5", p: "80 €" },
    { nom: "EA SPORTS FC 24 PS5", p: "80 €" },
    { nom: "Switch Pro Controller", p: "70 €" },
    { nom: "Volant Logitech G29", p: "300 €" },
    { nom: "Casque Sony Pulse 3D", p: "100 €" },
    { nom: "Station Charge DualSense", p: "30 €" },
    { nom: "Carte Seagate 1 To Xbox", p: "160 €" },
    { nom: "Gran Turismo 7 PS5", p: "80 €" },
    { nom: "Fujifilm Instax Mini 12", p: "90 €" },
    { nom: "Films Instax Mini (20)", p: "20 €" },
    { nom: "Trépied Manfrotto Befree", p: "190 €" },
    { nom: "Sac photo Lowepro BP 250", p: "150 €" },
    { nom: "Carte SD SanDisk 128 Go", p: "45 €" },
    { nom: "GoPro HERO12 Black", p: "400 €" },
    { nom: "Polaroid Now Gen 2", p: "130 €" },
    { nom: "Ring Light LED 10\"", p: "30 €" },
    { nom: "DJI Osmo Mobile 6", p: "160 €" },
    { nom: "Kit nettoyage optique", p: "15 €" },
    { nom: "20 000 Lieues (Hetzel)", p: "30 €" },
    { nom: "Tolkien SDA (Alan Lee)", p: "89 €" },
    { nom: "Le Petit Robert 2026", p: "69 €" },
    { nom: "Veiller sur elle (Goncourt)", p: "23 €" },
    { nom: "Le Silence et la Colère", p: "24 €" },
    { nom: "Sylvain Tesson - Blanc", p: "21 €" },
    { nom: "Son odeur après la pluie", p: "19 €" },
    { nom: "Harari - Sapiens", p: "24 €" },
    { nom: "Camus - L'Étranger", p: "8 €" },
    { nom: "Le Petit Prince (Couleur)", p: "14 €" },
    { nom: "Franck Thilliez - La Faille", p: "23 €" },
    { nom: "Guide Routard Toulouse", p: "11 €" },
    { nom: "Coffret One Piece (1-12)", p: "83 €" },
    { nom: "Astérix T40 L'Iris Blanc", p: "11 €" },
    { nom: "Naruto Tome 1", p: "7 €" },
    { nom: "Demon Slayer Tome 1", p: "7 €" },
    { nom: "Jujutsu Kaisen Tome 1", p: "7 €" },
    { nom: "Tintin : Rackham le Rouge", p: "13 €" },
    { nom: "Blacksad Tome 7", p: "16 €" },
    { nom: "Batman : Dark Knight Returns", p: "25 €" },
    { nom: "Dragon Ball Super Tome 1", p: "7 €" },
    { nom: "L'Arabe du futur T6", p: "25 €" },
    { nom: "Vinyle Daft Punk - RAM", p: "35 €" },
    { nom: "Vinyle Pink Floyd - Dark Side", p: "30 €" },
    { nom: "Vinyle Michael Jackson - Thriller", p: "32 €" },
    { nom: "Vinyle Queen - Greatest Hits", p: "38 €" },
    { nom: "Vinyle Nirvana - Nevermind", p: "28 €" },
    { nom: "Vinyle Orelsan - Civilisation", p: "30 €" },
    { nom: "Vinyle Miles Davis - Kind of Blue", p: "26 €" },
    { nom: "Brosse carbone vinyle", p: "18 €" },
    { nom: "Carnet Moleskine Large", p: "25 €" },
    { nom: "Stylo Caran d'Ache 849", p: "42 €" },
    { nom: "Feutres Faber-Castell (24)", p: "65 €" },
    { nom: "Bloc Rhodia N°18 A4", p: "6 €" },
    { nom: "Marqueurs Posca (8)", p: "32 €" },
    { nom: "Crayons Supracolor (12)", p: "35 €" },
    { nom: "LEGO Casque Dark Vador", p: "80 €" },
    { nom: "LEGO Fleurs Sauvages", p: "60 €" },
    { nom: "Jeu Catan (Asmodee)", p: "45 €" },
    { nom: "Jeu Dixit (Libellud)", p: "35 €" },
    { nom: "Jeu Dobble Classique", p: "16 €" },
    { nom: "Pokémon Coffret ETB", p: "60 €" }
  ];
  var EQUIPES = ['NEMO','NAUTILUS','ARONNAX','NEDLAND'];
  var EQUIPES_TEST = ['APERCU','TEST','ANON','ANON-TEST'];
  function hashString(s){ var h=0; for(var i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; } return h; }
  function motDeHash(h){ if(typeof h!=='number') return null; for(var i=0;i<REF_P1.length;i++){ if(hashString(REF_P1[i].w)===h) return REF_P1[i].w; } return null; }
  function lireP1DepuisLocal(equipe){
    try{
      var cands = ['nautilusP1TestWord:'+equipe, 'nautilusP1Session:'+equipe, 'nautilusP1TestSession:'+equipe, 'nautilusP1TestWord', 'nautilusP1TestSession', 'nautilusP1Word:'+equipe, 'nautilusP1TestWord:APERCU', 'nautilusP1TestSession:APERCU', 'nautilusP1Session:APERCU', 'nautilusP1TestWord:TEST', 'nautilusP1TestSession:TEST'];
      for(var _i=0;_i<cands.length;_i++){
        var raw=localStorage.getItem(cands[_i]);
        if(!raw) continue;
        try{
          var j=JSON.parse(raw);
          if(j && j.w) return j.w;
          if(j && j.word) return j.word;
          if(j && typeof j === 'string') return j;
          if(j && j.session && j.session.wordHash) {
            var m2=motDeHash(j.session.wordHash);
            if(m2) return m2;
          }
          if(j && j.session && j.session.word) return j.session.word;
          if(j && j.team && j.team===equipe && j.w) return j.w;
        }catch(e){
          if(raw && raw.length<30 && /^[A-ZÉÈÊÂÎÔÛÇ\-]+$/i.test(raw.trim())) return raw.trim().toUpperCase();
        }
      }
      // generic test session without team prefix
      var gen=localStorage.getItem('nautilusP1TestSession');
      if(gen){
        try{ var g=JSON.parse(gen); if(g && g.team===equipe && g.w) return g.w; if(g && g.word) return g.word; if(g && g.w) return g.w; }catch(e){}
      }
      // dernier recours : si equipe est NEMO et APERCU a un mot, l'afficher pour NEMO (test joué en APERCU mais lié à NEMO)
      if(equipe==='NEMO' || equipe==='NAUTILUS' || equipe==='ARONNAX' || equipe==='NEDLAND'){
        for(var k=0;k<['APERCU','TEST','ANON'].length;k++){
          var ek=['APERCU','TEST','ANON'][k];
          var cand2=localStorage.getItem('nautilusP1TestWord:'+ek);
          if(cand2){
            try{ var jj=JSON.parse(cand2); if(jj && jj.w) return jj.w; if(jj && jj.word) return jj.word; }catch(e){ if(cand2.length<30) return cand2.trim().toUpperCase(); }
          }
          var cand3=localStorage.getItem('nautilusP1TestSession:'+ek);
          if(cand3){
            try{ var jj3=JSON.parse(cand3); if(jj3 && jj3.w) return jj3.w; if(jj3 && jj3.word) return jj3.word; }catch(e){}
          }
        }
      }
    }catch(e){}
    return null;
  }
  function lireTeamDoc(code){
    try{
      if(window.NautilusAdminDb && window.NautilusAdminDb.getTeamDoc) return window.NautilusAdminDb.getTeamDoc(code);
      if(window.NautilusBlocages && window.NautilusBlocages.db) {
        return window.NautilusBlocages.db().then(function(x){
          return x.fs.getDoc(x.fs.doc(x.db, 'teams', code));
        });
      }
      if(S() && S().stockage) return S().stockage().lire('teams/'+code);
      if(window.Nautilus && window.Nautilus.getTeam) return window.Nautilus.getTeam(code);
    }catch(e){}
    return Promise.resolve(null);
  }
  function normaliserP2(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim(); }
  function lireP2DepuisLocal(equipe){
    try{
      var keys = ['nautilusGrilleMotsCroises:'+equipe, 'nautilusGrilleMotsCroises:APERCU', 'nautilusGrilleMotsCroises:TEST', 'nautilusGrilleMotsCroises:ANON'];
      // aussi test générique
      for(var i=0;i<keys.length;i++){
        var raw=localStorage.getItem(keys[i]);
        if(raw){ try{ var arr=JSON.parse(raw); if(Array.isArray(arr) && arr.length) return arr; }catch(e){} }
      }
      // Pour le mode test joué en tant que NEMO mais stocké sous APERCU, on a déjà géré NEMO fallback
      if(equipe==='NEMO'){
        var r2=localStorage.getItem('nautilusGrilleMotsCroises:APERCU');
        if(r2){ try{ var a2=JSON.parse(r2); if(Array.isArray(a2)&&a2.length) return a2; }catch(e){} }
      }
    }catch(e){}
    return null;
  }
  function majP2Chips(equipe, mots){
    var set = {};
    (mots||[]).forEach(function(w){ if(w) set[normaliserP2(w)] = true; });
    REF_P2.forEach(function(w){
      var el = $('afP2-'+equipe+'-'+w);
      if (!el) return;
      var ok = !!set[normaliserP2(w)];
      el.classList.toggle('adm-af-chip--hl', ok);
      if (ok) {
        el.style.background = 'rgba(46, 213, 115, 0.22)';
        el.style.borderColor = '#2ed573';
        el.style.color = '#a8ffcc';
        el.style.boxShadow = '0 0 10px rgba(46, 213, 115, 0.45)';
        el.style.fontWeight = '900';
        el.title = 'Découvert par l\'équipage';
      } else {
        el.style.background = '#03111f';
        el.style.borderColor = 'rgba(142, 231, 255, 0.38)';
        el.style.color = '#ffffff';
        el.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.4)';
        el.style.fontWeight = '800';
        el.title = '';
      }
    });
    // compteur dans le wrap title ? on peut ajouter nb verts dans pill ?
    var wrap = $('afP2wrap-'+equipe);
    if (wrap){
      var nb = (mots||[]).length;
      wrap.title = nb + '/' + REF_P2.length + ' mots découverts';
    }
  }
  var _unsubP2 = null;
  function ecouterP2Live(){
    if (_unsubP2) return;
    var getDb = null;
    try{
      if (window.NautilusAdminDb && window.NautilusAdminDb.db) {
        var adb = window.NautilusAdminDb;
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js').then(function(fs){
          var refCol = fs.collection(adb.db, 'teams');
          _unsubP2 = fs.onSnapshot(refCol, function(snap){
            snap.forEach(function(d){
              var data = d.data()||{};
              var equipe = d.id;
              if (EQUIPES.indexOf(equipe) < 0) return;
              var mc = data.motsCroises || data.palier2 || data.grilleMotsCroises || null;
              var liste = null;
              if (mc && Array.isArray(mc.motsJustes)) liste = mc.motsJustes;
              else if (mc && mc.motsJustes && typeof mc.motsJustes === 'object' && !Array.isArray(mc.motsJustes)) liste = Object.keys(mc.motsJustes).filter(function(k){ return mc.motsJustes[k]; });
              else if (Array.isArray(data.motsJustes)) liste = data.motsJustes;
              if (liste) majP2Chips(equipe, liste);

              // P3 : Photo Défi en direct
              var pd = data.photoDefi || data.palier3 || null;
              if (pd && pd.cibles && Array.isArray(pd.cibles)){
                majP3Chips(equipe, pd.cibles, pd.indexActuel);
              } else {
                majCarteP3Auto(equipe);
              }
            });
          }, function(){});
        }).catch(function(){});
        return;
      }
      if (window.NautilusBlocages && window.NautilusBlocages.db) getDb = window.NautilusBlocages.db;
      else if (S() && S().stockage && S().stockage()._base) return; // memoire, pas de live
    }catch(e){}
    if (!getDb) return;
    getDb().then(function(x){
      var refCol = x.fs.collection(x.db, 'teams');
      _unsubP2 = x.fs.onSnapshot(refCol, function(snap){
        snap.forEach(function(d){
          var data = d.data()||{};
          var equipe = d.id;
          if (EQUIPES.indexOf(equipe) < 0) return;
          var mc = data.motsCroises || data.palier2 || data.grilleMotsCroises || null;
          var liste = null;
          if (mc && Array.isArray(mc.motsJustes)) liste = mc.motsJustes;
          else if (mc && mc.motsJustes && typeof mc.motsJustes === 'object' && !Array.isArray(mc.motsJustes)) liste = Object.keys(mc.motsJustes).filter(function(k){ return mc.motsJustes[k]; });
          else if (Array.isArray(data.motsJustes)) liste = data.motsJustes;
          if (liste) majP2Chips(equipe, liste);

          // P3 : Photo Défi en direct
          var pd = data.photoDefi || data.palier3 || null;
          if (pd && pd.cibles && Array.isArray(pd.cibles)){
            majP3Chips(equipe, pd.cibles, pd.indexActuel);
          } else {
            majCarteP3Auto(equipe);
          }
        });
      }, function(){ /* lecture indisponible */ });
    }).catch(function(){});
  }

  function majP3Chips(equipe, cibles, indexActuel){
    var wrap = $('afP3wrap-'+equipe);
    if (!wrap){
      var row = $('afP3-'+equipe);
      if (row) {
        row.innerHTML = '<span class="adm-af-lbl">P3</span><div class="adm-af-chips" id="afP3wrap-'+equipe+'"></div>';
        wrap = $('afP3wrap-'+equipe);
      }
    }
    if (!wrap) return;
    if (!cibles || !cibles.length){
      wrap.innerHTML = '<span class="small" style="color:#9bc4d4">en attente</span>';
      return;
    }
    var idx = typeof indexActuel === 'number' ? indexActuel : 0;
    wrap.innerHTML = cibles.map(function(c, i){
      var valide = i < idx;
      var label = (i + 1) + '. ' + (c.court || c.titre || c.id || ('Cible ' + (i + 1)));
      var titreComplet = (c.titre || c.id) + (c.rayon ? ' (' + c.rayon + ')' : '');
      var bg = valide ? 'rgba(46, 213, 115, 0.22)' : '#03111f';
      var border = valide ? '#2ed573' : 'rgba(142, 231, 255, 0.38)';
      var col = valide ? '#a8ffcc' : '#ffffff';
      var fw = valide ? '900' : '800';
      var shadow = valide ? '0 0 10px rgba(46, 213, 115, 0.45)' : '0 2px 6px rgba(0, 0, 0, 0.4)';
      return '<span class="adm-af-chip' + (valide ? ' adm-af-chip--hl' : '') + '" title="' + esc(titreComplet) + '" style="display:inline-flex;align-items:center;font-size:11px;font-weight:' + fw + ';background:' + bg + ';color:' + col + ';border:1.5px solid ' + border + ';border-radius:999px;padding:4px 10px;white-space:nowrap;flex:0 0 auto;box-shadow:' + shadow + ';letter-spacing:.02em;line-height:1.3">'
        + (valide ? '✓ ' : '') + esc(label)
        + '</span>';
    }).join('');
    wrap.title = idx + '/' + cibles.length + ' cibles validées';
  }

  var _ecouteP3Branchee = false;
  function ecouterP3Live() {
    if (_ecouteP3Branchee) return;
    _ecouteP3Branchee = true;

    window.addEventListener('storage', function(e){
      if (e.key && e.key.indexOf('nautilusP3') >= 0){
        EQUIPES.forEach(majCarteP3Auto);
        majCarteP3Auto('TEST');
      }
    });
    window.addEventListener('nautilus:p3-cibles-change', function(e){
      if (e.detail && e.detail.equipe){
        majCarteP3Auto(e.detail.equipe);
      } else {
        EQUIPES.forEach(majCarteP3Auto);
        majCarteP3Auto('TEST');
      }
    });
  }

  function aleaSeed(graine) {
    var h = 2166136261;
    var s = String(graine);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return function () {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return ((h >>> 0) % 100000) / 100000;
    };
  }

  function getP4PourEquipe(equipeCode) {
    var rnd = aleaSeed('palier4_' + String(equipeCode || 'NEMO').toUpperCase());
    var n = 9, N = n * n;
    var libres = [];
    for (var c = 0; c < N; c++) libres.push(c);
    var res = [];
    for (var m = 0; m < REF_P4.length; m++) {
      var k = Math.floor(rnd() * libres.length);
      var cell = libres[k];
      libres.splice(k, 1);
      var lig = String.fromCharCode(65 + Math.floor(cell / n));
      var col = (cell % n) + 1;
      res.push({ s: REF_P4[m].s, nom: REF_P4[m].nom, c: lig + col });
    }
    return res;
  }

  function getP5PourEquipe(equipeCode) {
    var rnd = aleaSeed('palier5_' + String(equipeCode || 'NEMO').toUpperCase());
    var pool = REF_P5.slice();
    var res = [];
    for (var i = 0; i < 10 && pool.length > 0; i++) {
      var k = Math.floor(rnd() * pool.length);
      res.push(pool.splice(k, 1)[0]);
    }
    return res;
  }

  function renderP4Chips(equipeCode) {
    if (window.NautilusBataille && window.NautilusBataille.getFlottePourEquipe) {
      var flotte = window.NautilusBataille.getFlottePourEquipe(equipeCode);
      return flotte.map(function(nav){
        return '<span class="adm-af-chip" style="'+CHIP_STYLE_DEFAULT+'" title="'+esc(nav.nom)+' ('+nav.taille+' cases)">'
          + '<b>'+nav.ico+' '+esc(nav.nom)+'</b> : <b style="color:#8ee7ff">'+esc(nav.coords.join(' · '))+'</b></span>';
      }).join('');
    }
    var p4 = getP4PourEquipe(equipeCode);
    return p4.map(function(m){
      return '<span class="adm-af-chip" style="'+CHIP_STYLE_DEFAULT+'" title="'+esc(m.nom)+'"><b>'+esc(m.s)+'</b> : <b style="color:#8ee7ff">'+esc(m.c)+'</b></span>';
    }).join('');
  }

  function renderP5Chips(equipeCode) {
    var p5 = getP5PourEquipe(equipeCode);
    return p5.map(function(item, idx){
      return '<span class="adm-af-chip" style="'+CHIP_STYLE_DEFAULT+'" title="'+esc(item.nom)+'"><b>'+(idx + 1)+'.</b> '+esc(item.nom)+' : <b style="color:#ffd36c">'+esc(item.p)+'</b></span>';
    }).join('');
  }

  function renderP6Chips(equipeCode) {
    if (!window.NautilusQuiz || !window.NautilusQuiz.tirerQuestionsPourEquipe) {
      return '<span class="small" style="color:#9bc4d4">quiz en attente de chargement</span>';
    }
    var res = window.NautilusQuiz.tirerQuestionsPourEquipe(equipeCode);
    var p6 = (res && res.selection) ? res.selection : [];
    return p6.map(function(q, idx){
      var bonneRep = q.reps[q.ok];
      return '<span class="adm-af-chip" style="'+CHIP_STYLE_DEFAULT+'" title="'+esc(q.q)+'"><b>'+(idx + 1)+'.</b> '+esc(q.domaine)+' : <b style="color:#5be09b">'+esc(bonneRep)+'</b></span>';
    }).join('');
  }

  function htmlToutesReponses(){
    return ''
    + '<p class="small" style="margin-bottom:10px">Bonnes réponses attendues par palier pour chaque équipage (P1 mot de passe, P2 mots croisés, P3 chasse aux artefacts, P4 traque sonar avec coordonnées des 4 créatures abyssales, P5 les 10 articles sélectionnés avec leurs prix respectifs Fnac, P6 les 10 questions du Grand Quiz des Abysses avec leurs réponses exactes).</p>'
    + '<div id="afTeamCards" class="adm-af-cards teamlist" style="display:flex;flex-direction:column;gap:12px;padding:4px 0 8px">'
    +   EQUIPES.map(function(eq){
          var p2 = REF_P2.map(function(w){ return '<span class="adm-af-chip" id="afP2-'+eq+'-'+w+'" style="'+CHIP_STYLE_DEFAULT+'">'+esc(w)+'</span>'; }).join('');
          var p4 = renderP4Chips(eq);
          var p5 = renderP5Chips(eq);
          var p6 = renderP6Chips(eq);
          return '<div class="adm-af-teamcard" data-team="'+eq+'" style="margin:0;padding:12px 14px;background:rgba(4,18,32,0.92);border:1px solid rgba(142,231,255,0.3);border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.4);color:#eaf8ff">'
            + '<div class="adm-af-teamhead" style="font-size:13px;font-weight:900;letter-spacing:.05em;display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;color:#ffd36c"><span style="color:#ffd36c;font-weight:900">'+eq+'</span><span class="small" id="afTeamPill-'+eq+'" style="color:#9bc4d4;font-weight:600">…</span></div>'
            + '<div class="adm-af-row" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P1</span><span class="adm-af-chip" id="afP1-'+eq+'" style="'+CHIP_STYLE_DEFAULT+'">—</span></div>'
            + '<div class="adm-af-row" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P2</span><div class="adm-af-chips" id="afP2wrap-'+eq+'" style="display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;flex:1;min-width:0;padding:2px 2px 4px">'+p2+'</div></div>'
            + '<div class="adm-af-row" id="afP3-'+eq+'" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P3</span><div class="adm-af-chips" id="afP3wrap-'+eq+'" style="display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;flex:1;min-width:0;padding:2px 2px 4px"></div></div>'
            + '<div class="adm-af-row" id="afP4-'+eq+'" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P4</span><div class="adm-af-chips" id="afP4wrap-'+eq+'" style="display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;flex:1;min-width:0;padding:2px 2px 4px">'+p4+'</div></div>'
            + '<div class="adm-af-row" id="afP5-'+eq+'" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P5</span><div class="adm-af-chips" id="afP5wrap-'+eq+'" style="display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;flex:1;min-width:0;padding:2px 2px 4px">'+p5+'</div></div>'
            + '<div class="adm-af-row" id="afP6-'+eq+'" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P6</span><div class="adm-af-chips" id="afP6wrap-'+eq+'" style="display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;flex:1;min-width:0;padding:2px 2px 4px">'+p6+'</div></div>'
            + '</div>';
        }).join('')
    +   (function(){
          var eqT='TEST';
          var p2t = REF_P2.map(function(w){ return '<span class="adm-af-chip" id="afP2-'+eqT+'-'+w+'" style="'+CHIP_STYLE_DEFAULT+'">'+esc(w)+'</span>'; }).join('');
          var p4t = renderP4Chips(eqT);
          var p5t = renderP5Chips(eqT);
          var p6t = renderP6Chips(eqT);
          return '<div class="adm-af-teamcard" data-team="'+eqT+'" style="margin:0;padding:12px 14px;background:rgba(245,176,39,0.12);border:1px solid rgba(245,176,39,0.45);border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,0.35);color:#eaf8ff">'
            + '<div class="adm-af-teamhead" style="font-size:13px;font-weight:900;letter-spacing:.05em;display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;color:#ffd36c"><span style="color:#ffd36c;font-weight:900">🧪 zzzz-0000 <span class="small" style="background:rgba(245,176,39,0.25);border:1px solid rgba(245,176,39,0.5);color:#ffd36c;border-radius:999px;padding:2px 7px;font-size:10px">TEST ADMIN</span></span><span class="small" id="afTeamPill-'+eqT+'" style="color:#9bc4d4;font-weight:600">test</span></div>'
            + '<div class="adm-af-row" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P1</span><span class="adm-af-chip" id="afP1-'+eqT+'" style="'+CHIP_STYLE_DEFAULT+'">—</span></div>'
            + '<div class="adm-af-row" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P2</span><div class="adm-af-chips" id="afP2wrap-'+eqT+'" style="display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;flex:1;min-width:0;padding:2px 2px 4px">'+p2t+'</div></div>'
            + '<div class="adm-af-row" id="afP3-'+eqT+'" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P3</span><div class="adm-af-chips" id="afP3wrap-'+eqT+'" style="display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;flex:1;min-width:0;padding:2px 2px 4px"></div></div>'
            + '<div class="adm-af-row" id="afP4-'+eqT+'" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P4</span><div class="adm-af-chips" id="afP4wrap-'+eqT+'" style="display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;flex:1;min-width:0;padding:2px 2px 4px">'+p4t+'</div></div>'
            + '<div class="adm-af-row" id="afP5-'+eqT+'" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P5</span><div class="adm-af-chips" id="afP5wrap-'+eqT+'" style="display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;flex:1;min-width:0;padding:2px 2px 4px">'+p5t+'</div></div>'
            + '<div class="adm-af-row" id="afP6-'+eqT+'" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P6</span><div class="adm-af-chips" id="afP6wrap-'+eqT+'" style="display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;flex:1;min-width:0;padding:2px 2px 4px">'+p6t+'</div></div>'
            + '</div>';
        })()
    + '</div>';
  }
  function assurerCarteEquipeDynamique(equipe){
    if(!equipe) return null;
    equipe = String(equipe).trim().toUpperCase().replace(/[^A-Z0-9-]/g,'');
    if(!equipe) return null;
    // déjà existante ?
    if(document.getElementById('afP3-'+equipe)) return document.getElementById('afP3-'+equipe);
    // Ne pas dupliquer les 4 fixes déjà créées
    if(EQUIPES.indexOf(equipe)>=0 || equipe==='TEST') return document.getElementById('afP3-'+equipe);
    var host = document.getElementById('afTeamCards');
    if(!host) return null;
    // Construit une carte similaire aux fixes
    var p2 = REF_P2.map(function(w){ return '<span class="adm-af-chip" id="afP2-'+equipe+'-'+w+'" style="'+CHIP_STYLE_DEFAULT+'">'+esc(w)+'</span>'; }).join('');
    var p4 = renderP4Chips(equipe);
    var p5 = renderP5Chips(equipe);
    var p6 = renderP6Chips(equipe);
    var card = document.createElement('div');
    card.className = 'adm-af-teamcard';
    card.dataset.team = equipe;
    card.style.cssText = 'margin:0;padding:12px 14px;background:rgba(91,255,156,0.1);border:1px solid rgba(91,255,156,0.35);border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,0.35);color:#eaf8ff';
    card.innerHTML = '<div class="adm-af-teamhead" style="font-size:13px;font-weight:900;letter-spacing:.05em;display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;color:#ffd36c"><span style="color:#ffd36c;font-weight:900">'+esc(equipe)+' <span class="small" style="background:rgba(91,255,156,0.2);border:1px solid rgba(91,255,156,0.5);color:#7ce6ad;border-radius:999px;padding:2px 7px;font-size:10px">SESSION LIVE</span></span><span class="small" id="afTeamPill-'+equipe+'" style="color:#9bc4d4;font-weight:600">auto</span></div>'
      + '<div class="adm-af-row" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P1</span><span class="adm-af-chip" id="afP1-'+equipe+'" style="'+CHIP_STYLE_DEFAULT+'">—</span></div>'
      + '<div class="adm-af-row" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P2</span><div class="adm-af-chips" id="afP2wrap-'+equipe+'" style="display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;flex:1;min-width:0;padding:2px 2px 4px">'+p2+'</div></div>'
      + '<div class="adm-af-row" id="afP3-'+equipe+'" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P3</span><div class="adm-af-chips" id="afP3wrap-'+equipe+'" style="display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;flex:1;min-width:0;padding:2px 2px 4px"></div></div>'
      + '<div class="adm-af-row" id="afP4-'+equipe+'" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P4</span><div class="adm-af-chips" id="afP4wrap-'+equipe+'" style="display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;flex:1;min-width:0;padding:2px 2px 4px">'+p4+'</div></div>'
      + '<div class="adm-af-row" id="afP5-'+equipe+'" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P5</span><div class="adm-af-chips" id="afP5wrap-'+equipe+'" style="display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;flex:1;min-width:0;padding:2px 2px 4px">'+p5+'</div></div>'
      + '<div class="adm-af-row" id="afP6-'+equipe+'" style="display:flex;align-items:center;gap:8px;margin:8px 0;min-width:0"><span class="adm-af-lbl" style="'+LBL_STYLE+'">P6</span><div class="adm-af-chips" id="afP6wrap-'+equipe+'" style="display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;flex:1;min-width:0;padding:2px 2px 4px">'+p6+'</div></div>';
    // insère avant la carte TEST si elle existe, sinon à la fin
    var testCard = host.querySelector('[data-team="TEST"]');
    if(testCard) host.insertBefore(card, testCard);
    else host.appendChild(card);
    return document.getElementById('afP3-'+equipe);
  }

  function majCartesEquipes(){
    EQUIPES.forEach(function(eq){
      lireTeamDoc(eq).then(function(doc){
        var pill=$('afTeamPill-'+eq); var p1=$('afP1-'+eq);
        var d=null, payload=null;
        if(doc){
          d=doc.data? doc.data() : doc;
          payload = d || doc;
        }
        // P1 : Firestore d'abord, puis localStorage test
        var mot = '';
        if(payload){
          var h = payload.morseWordHash!=null ? payload.morseWordHash : (payload.data && payload.data.morseWordHash);
          if(h==null && payload.morseWordHash!=null) h=payload.morseWordHash;
          mot = motDeHash(h) || (payload.morseWord || '');
        }
        if(!mot){
          mot = lireP1DepuisLocal(eq) || '';
        }
        if(p1) {
          p1.textContent = mot || '—';
          p1.classList.toggle('adm-af-chip--hl', !!mot);
          if (mot) {
            p1.style.background = 'rgba(46, 213, 115, 0.22)';
            p1.style.borderColor = '#2ed573';
            p1.style.color = '#a8ffcc';
            p1.style.boxShadow = '0 0 10px rgba(46, 213, 115, 0.45)';
            p1.style.fontWeight = '900';
          } else {
            p1.style.background = '#03111f';
            p1.style.borderColor = 'rgba(142, 231, 255, 0.38)';
            p1.style.color = '#ffffff';
            p1.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.4)';
            p1.style.fontWeight = '800';
          }
        }
        if(pill){
          if(payload){
            var members = payload.members ? payload.members.length : (payload.data && payload.data.members ? payload.data.members.length : 0);
            pill.textContent = members ? members+' matelots' : 'vide';
          } else if(mot){
            pill.textContent = 'test';
          } else {
            pill.textContent = '—';
          }
        }
        // P2 : Firestore ou local
        try{
          var liste = null;
          if(payload){
            var mc = payload.motsCroises || payload.palier2 || payload.grilleMotsCroises || null;
            if (mc && Array.isArray(mc.motsJustes)) liste = mc.motsJustes;
            else if (mc && mc.motsJustes && typeof mc.motsJustes === 'object' && !Array.isArray(mc.motsJustes)) liste = Object.keys(mc.motsJustes).filter(function(k){ return mc.motsJustes[k]; });
            else if (Array.isArray(payload.motsJustes)) liste = payload.motsJustes;
            else if (payload.motsCroises && Array.isArray(payload.motsCroises)) liste = payload.motsCroises;
          }
          if (!liste || !liste.length){
            liste = lireP2DepuisLocal(eq);
          }
          if (liste) majP2Chips(eq, liste); else majP2Chips(eq, []);
        }catch(e){ try{ majP2Chips(eq, []);}catch(e2){} }
        // P3 : Photo Défi (5 cibles en direct)
        try{
          var pd = payload ? (payload.photoDefi || payload.palier3 || null) : null;
          if (pd && pd.cibles && Array.isArray(pd.cibles)){
            majP3Chips(eq, pd.cibles, pd.indexActuel);
          } else {
            majCarteP3Auto(eq);
          }
        }catch(e){ majCarteP3Auto(eq); }
        try {
          var w4 = $('afP4wrap-' + eq);
          if (w4) w4.innerHTML = renderP4Chips(eq);
          var w5 = $('afP5wrap-' + eq);
          if (w5) w5.innerHTML = renderP5Chips(eq);
          var w6 = $('afP6wrap-' + eq);
          if (w6) w6.innerHTML = renderP6Chips(eq);
        } catch(e) {}
        if(!doc && !mot){
           // même sans doc, on tente quand même P2 via local déjà fait
        }
      }).catch(function(){
        // Firestore erreur → fallback local
        try{
          var mLocal = lireP1DepuisLocal(eq);
          var p1b=$('afP1-'+eq);
          if(p1b) {
            p1b.textContent = mLocal || '—';
            p1b.classList.toggle('adm-af-chip--hl', !!mLocal);
            if (mLocal) {
              p1b.style.background = 'rgba(46, 213, 115, 0.22)';
              p1b.style.borderColor = '#2ed573';
              p1b.style.color = '#a8ffcc';
              p1b.style.boxShadow = '0 0 10px rgba(46, 213, 115, 0.45)';
              p1b.style.fontWeight = '900';
            } else {
              p1b.style.background = '#03111f';
              p1b.style.borderColor = 'rgba(142, 231, 255, 0.38)';
              p1b.style.color = '#ffffff';
              p1b.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.4)';
              p1b.style.fontWeight = '800';
            }
          }
          var l2 = lireP2DepuisLocal(eq);
          if(l2) majP2Chips(eq, l2); else majP2Chips(eq, []);
        }catch(e){ try{ majP2Chips(eq, []);}catch(e2){} }
        majCarteP3Auto(eq);
        try {
          var w4b = $('afP4wrap-' + eq);
          if (w4b) w4b.innerHTML = renderP4Chips(eq);
          var w5b = $('afP5wrap-' + eq);
          if (w5b) w5b.innerHTML = renderP5Chips(eq);
          var w6b = $('afP6wrap-' + eq);
          if (w6b) w6b.innerHTML = renderP6Chips(eq);
        } catch(e) {}
      });
    });
    // Card test admin zzzz-0000 — alimente le sous-bloc TEST à l'intérieur du card unique
    try{
      (function peuplerTestAdmin(){
        var eq='TEST';
        try{
          var motTest = lireP1DepuisLocal('TEST') || lireP1DepuisLocal('APERCU') || lireP1DepuisLocal('ANON') || lireP1DepuisLocal('MODE_TEST') || lireP1DepuisLocal('ZZZZ-0000') || '';
          if(!motTest){ try{ var g=localStorage.getItem('nautilusP1TestWord'); if(g){ try{ var jg=JSON.parse(g); motTest=jg.w||jg.word||''; }catch(e){ motTest=g; }} }catch(e){} }
          if(!motTest){ try{ var g2=localStorage.getItem('nautilusP1TestWord:TEST'); if(g2){ try{ var jg2=JSON.parse(g2); motTest=jg2.w||jg2.word||jg2; }catch(e){ motTest=g2; }} }catch(e){} }
          var p1m=$('afP1-'+eq);
          if(p1m) {
            p1m.textContent = motTest || '—';
            p1m.classList.toggle('adm-af-chip--hl', !!motTest);
            if (motTest) {
              p1m.style.background = 'rgba(46, 213, 115, 0.22)';
              p1m.style.borderColor = '#2ed573';
              p1m.style.color = '#a8ffcc';
              p1m.style.boxShadow = '0 0 10px rgba(46, 213, 115, 0.45)';
              p1m.style.fontWeight = '900';
            } else {
              p1m.style.background = '#03111f';
              p1m.style.borderColor = 'rgba(142, 231, 255, 0.38)';
              p1m.style.color = '#ffffff';
              p1m.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.4)';
              p1m.style.fontWeight = '800';
            }
          }
          var pillM=$('afTeamPill-'+eq); if(pillM) pillM.textContent = motTest ? 'donnée test trouvée' : 'test — zzzz-0000';
          var listeM = lireP2DepuisLocal('TEST') || lireP2DepuisLocal('APERCU') || lireP2DepuisLocal('ANON') || lireP2DepuisLocal('MODE_TEST') || null;
          if(listeM && listeM.length){ majP2Chips(eq, listeM); } else { majP2Chips(eq, []); }
          majCarteP3Auto(eq);
          try {
            var w4t = $('afP4wrap-' + eq);
            if (w4t) w4t.innerHTML = renderP4Chips(eq);
            var w5t = $('afP5wrap-' + eq);
            if (w5t) w5t.innerHTML = renderP5Chips(eq);
            var w6t = $('afP6wrap-' + eq);
            if (w6t) w6t.innerHTML = renderP6Chips(eq);
          } catch(e) {}
          // sync also IDs with zzzz-0000 alias if used
          var eqAlias='ZZZZ-0000';
          // no UI for alias, but ensure localStorage alias is mirrored
        }catch(e){ try{ majCarteP3Auto(eq); }catch(e2){} }
      })();
    }catch(e){}
    // Découverte des sessions live non listées dans EQUIPES (ex: ANON-xxxx, teams créés côté client) — crée une carte à la volée
    try{
      if(window.NautilusBlocages && window.NautilusBlocages.db){
        window.NautilusBlocages.db().then(function(x){
          x.fs.getDocs(x.fs.collection(x.db, 'sessions')).then(function(snap){
            snap.forEach(function(d){
              var equipe = d.id;
              if(EQUIPES.indexOf(equipe)>=0 || equipe==='TEST') return;
              // évite de créer des cartes pour des ids techniques trop longs ou invalides
              if(!/^[A-Z0-9-]{2,24}$/.test(equipe)) return;
              if(document.getElementById('afP3-'+equipe)) return;
              assurerCarteEquipeDynamique(equipe);
              majCarteP3Auto(equipe);
            });
          }).catch(function(){});
        }).catch(function(){});
      }
    }catch(e){}
    try{ ecouterP2Live(); }catch(e){}
    try{ ecouterP3Live(); }catch(e){}
  }
  function majCarteP3Auto(equipe){
    try{
      var cibles = null, indexActuel = 0;
      var raw = localStorage.getItem('nautilusP3Cibles:' + equipe);
      if (raw){
        try{ cibles = JSON.parse(raw); }catch(e){}
      }
      var rawIdx = localStorage.getItem('nautilusP3Index:' + equipe);
      if (rawIdx != null) indexActuel = Number(rawIdx) || 0;

      if (!cibles || !cibles.length){
        if (window.NautilusPhotoDefi && window.NautilusPhotoDefi.getCiblesEquipe){
          cibles = window.NautilusPhotoDefi.getCiblesEquipe(equipe);
        }
      }
      if (cibles && cibles.length){
        majP3Chips(equipe, cibles, indexActuel);
      } else {
        var row = $('afP3-'+equipe);
        if (row && !$('afP3wrap-'+equipe)){
          row.innerHTML = '<span class="adm-af-lbl" style="' + LBL_STYLE + '">P3</span><div class="adm-af-chips" id="afP3wrap-'+equipe+'" style="display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;flex:1;min-width:0;padding:2px 2px 4px"><span class="small" style="color:#9bc4d4">en attente</span></div>';
        }
      }
    }catch(e){}
  }

  function HTML_REP() {
    return htmlToutesReponses();
  }

  // ── QR Codes paliers 2→7 (déverrouillage Zone Scellée) ──
  var QR_PALIERS = [
    { n: 2, code: '1721310619',  page: '1721310619.html' },
    { n: 3, code: '1831411720',  page: '1831411720.html' },
    { n: 4, code: '1941512821',  page: '1941512821.html' },
    { n: 5, code: '2051613922',  page: '2051613922.html' },
    { n: 6, code: '21617141023', page: '21617141023.html' },
    { n: 7, code: '22718151124', page: '22718151124.html' }
  ];
  function HTML_QR(){
    var planche = 'assets/qr/planche-qr.png';
    var html = ''
    + '<p class="small" style="margin-bottom:10px">QR Codes de déverrouillage des <b>Zones Scellées</b> (paliers 2 → 7). Chaque code encode le <b>numéro du palier</b> (ex. <code>1721310619</code>) — le logo <b>Nautilus</b> est intégré au centre. Imprime la variante <b>noir sur blanc</b> pour une compatibilité maximale, ou <b>jaune sur noir</b> pour l’ambiance Nautilus. Tous les QR sont scannables avec la caméra ou l’import photo du sas.</p>'
    + '<div class="adm-af-sec">'
    +   '<h4>📋 Planche complète — 6 paliers × 2 variantes</h4>'
    +   '<p class="small" style="margin-bottom:8px"><a href="'+planche+'" download="planche-qr-nautilus.png" style="background:#f5b027;color:#04101d;border-radius:999px;padding:6px 14px;text-decoration:none;font-weight:900;display:inline-block">⬇️ Télécharger la planche (2020×6600 px)</a> <span style="margin-left:8px;color:#9bc4d4">12 QR étiquetés</span></p>'
    +   '<a href="'+planche+'" download="planche-qr-nautilus.png" style="display:block;max-width:720px;border:1px solid rgba(142,231,255,0.3);border-radius:10px;overflow:hidden"><img src="'+planche+'" alt="Planche QR Nautilus" style="width:100%;height:auto;display:block" loading="lazy"></a>'
    + '</div>'
    + '<div class="adm-qr-grid">';
    QR_PALIERS.forEach(function(p){
      var noir = 'assets/qr/QR-palier-'+p.n+'_noir-sur-blanc.png';
      var jaune = 'assets/qr/QR-palier-'+p.n+'_jaune-sur-noir.png';
      html += ''
      + '<div class="adm-qr-card">'
      +   '<h5>Palier '+p.n+' — <code>'+esc(p.code)+'</code> <span style="font-weight:400;color:#9bc4d4">→ '+esc(p.page)+'</span></h5>'
      +   '<div class="adm-qr-imgs">'
      +     '<div class="adm-qr-imgbox" style="background:rgba(4,18,30,0.85);border:1px solid rgba(142,231,255,0.25)"><div class="small" style="font-weight:700;margin-bottom:4px;color:#eaf8ff">Noir sur blanc</div><img src="'+noir+'" alt="QR palier '+p.n+' noir" loading="lazy"><div class="small" style="color:#9bc4d4;margin-top:4px">Impression standard</div></div>'
      +     '<div class="adm-qr-imgbox" style="background:#020812;border-color:#1a2a3a"><div class="small" style="font-weight:700;margin-bottom:4px;color:#f5b027">Jaune sur noir</div><img src="'+jaune+'" alt="QR palier '+p.n+' jaune" loading="lazy"><div class="small" style="color:#8ee7ff;margin-top:4px">Ambiance Nautilus</div></div>'
      +   '</div>'
      +   '<div class="adm-qr-dl">'
      +     '<a href="'+noir+'" download="QR-palier-'+p.n+'_noir-sur-blanc.png">⬇️ Noir / blanc</a>'
      +     '<a href="'+jaune+'" download="QR-palier-'+p.n+'_jaune-sur-noir.png">⬇️ Jaune / noir</a>'
      +   '</div>'
      +   '<p class="small" style="color:#9bc4d4;margin-top:6px">Logo Nautilus au centre · correction H (30 %) · testé jsQR</p>'
      + '</div>';
    });
    html += '</div>'
    + '<p class="small" style="margin-top:12px;color:#9bc4d4">Taille conseillée ≥ 6×6 cm, ne pas rogner la zone de silence. La variante jaune est un QR inversé — testée avec l’app (jsQR <code>inversionAttempts:both</code>). En cas de doute, imprime la variante noire. Régénération : <code>python3 tools/generate_qr.py</code>.</p>';
    return html;
  }


  function injecter() {
    ensureTabsCss();
    if (_monte) return;
    var workspace = $('adminWorkspace');
    if (!workspace) return;
    var tabs = workspace.querySelector('.admin-tabs');
    if (!tabs) return;
    // évite double injection
    if (workspace.querySelector('[data-pane="' + ONGLET_MAG + '"]') || workspace.querySelector('[data-pane="' + ONGLET_REP + '"]') || workspace.querySelector('[data-pane="' + ONGLET_QR + '"]')) {
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
    btnRep.innerHTML = '<span class="lbl-desktop">🔑 Bonnes réponses attendues</span><span class="lbl-mobile" aria-label="Réponses">🔑</span>';
    // --- bouton QR Codes
    var btnQR = document.createElement('button');
    btnQR.className = 'admin-tab';
    btnQR.type = 'button';
    btnQR.setAttribute('role', 'tab');
    btnQR.dataset.tab = ONGLET_QR;
    btnQR.innerHTML = '<span class="lbl-desktop">📷 QR Codes</span><span class="lbl-mobile" aria-label="QR Codes">📷</span>';

    var danger = tabs.querySelector('[data-tab="danger"]'); // data-tab="danger"
    if (danger) {
      tabs.insertBefore(btnQR, danger);
      tabs.insertBefore(btnRep, danger);
      tabs.insertBefore(btnMag, btnRep);
    } else {
      tabs.appendChild(btnMag);
      tabs.appendChild(btnRep);
      tabs.appendChild(btnQR);
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

    var paneQR = document.createElement('div');
    paneQR.className = 'admin-pane';
    paneQR.dataset.pane = ONGLET_QR;
    paneQR.style.display = 'none';
    paneQR.innerHTML = HTML_QR();
    workspace.appendChild(paneQR);

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
    if (target === ONGLET_REP) { try{ majCartesEquipes(); }catch(e){} try{ ecouterP3Live(); }catch(e2){} }
  }

  function brancher() {
    var bMag = document.querySelector('.admin-tab[data-tab="' + ONGLET_MAG + '"]');
    if (bMag) bMag.addEventListener('click', function(){ activerOnglet(ONGLET_MAG); });
    var bRep = document.querySelector('.admin-tab[data-tab="' + ONGLET_REP + '"]');
    if (bRep) bRep.addEventListener('click', function(){ activerOnglet(ONGLET_REP); });
    var bQR = document.querySelector('.admin-tab[data-tab="' + ONGLET_QR + '"]');
    if (bQR) bQR.addEventListener('click', function(){ activerOnglet(ONGLET_QR); });

    // --- Magasins
    var r = $('afMagReload'); if (r) r.addEventListener('click', function(){ charger(true); });
    var v = $('afMagVerifier'); if (v) v.addEventListener('click', verifier);
    var p = $('afMagPublier'); if (p) p.addEventListener('click', publier);
    var e = $('afMagExporter'); if (e) e.addEventListener('click', exporter);
    var s = $('afMagSearch'); if (s) s.addEventListener('input', function(){ _filtre = (s.value||'').toLowerCase().trim(); rendreMag(); });
    var a = $('afMagAjouter'); if (a) a.addEventListener('click', ajouterOuMaj);
    var cl = $('afMagVider'); if (cl) cl.addEventListener('click', viderForm);

    // Réponses des deux premiers paliers ; le troisième est une chasse aux artefacts.
  }

  // ===================== MAGASINS =====================
  function majLast() {
    var el = $('afMagLast');
    if (!el || !_liste) return;
    var dt = fmtDate(_liste.syncedAt);
    var badge = fmtSource(_liste.source, _liste.sourceType);
    var note = _liste.note ? '<br><span class="small" style="color:#9bc4d4">' + esc(_liste.note) + '</span>' : '';
    el.innerHTML = '<b>Dernière mise à jour :</b> ' + dt + ' ' + badge + ' <span class="small" style="color:#9bc4d4">(' + esc(age(_liste.syncedAt)) + ')</span><br>'
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
    var html = '<table class="adm-af-table" style="width:100%"><thead><tr><th>id</th><th>Nom — ville (CP)</th><th></th></tr></thead><tbody>'
      + arr.map(function(m){
        return '<tr>'
          + '<td><code>' + esc(m.id||'—') + '</code>' + (m.actif===false?'<br><span class="adm-af-badge adm-af-badge--warn">inactif</span>':'') + '</td>'
          + '<td><b>' + esc(m.nom||'?') + '</b><br><span class="small">' + esc(m.ville||'—') + ' ' + esc(m.cp||'') + '</span><br><span class="small">' + esc(m.slug||'') + '</span></td>'
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
    ONGLET_MAG: ONGLET_MAG, ONGLET_REP: ONGLET_REP, ONGLET_QR: ONGLET_QR, injecter: injecter, activerOnglet: activerOnglet,
    estMonte: function(){ return _monte; }
  };
})();
