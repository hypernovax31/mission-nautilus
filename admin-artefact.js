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
  var _dernierLivre = null; // dernier livre parsé depuis Fnac
  function ensureTabsCss(){
    if(document.getElementById('nautilusAdminTabsFix')) return;
    var st=document.createElement('style');
    st.id='nautilusAdminTabsFix';
    st.textContent='.admin-tabs{display:flex;flex-wrap:nowrap;gap:4px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:4px}.admin-tabs::-webkit-scrollbar{display:none}.admin-tab{flex:0 0 auto;white-space:nowrap;min-width:36px;justify-content:center}.admin-pane{min-width:0;overflow-wrap:anywhere;max-width:100%}#adminPanel .body{overflow-x:hidden}'
      + '.adm-af-cards{display:flex;gap:10px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory;padding:6px 2px 8px;scrollbar-width:none}.adm-af-cards::-webkit-scrollbar{display:none}'
      + '.adm-af-teamcard{flex:0 0 86vw;max-width:340px;min-width:260px;scroll-snap-align:start;background:#fff;border:1px solid #dfe8ee;border-radius:12px;padding:10px;box-shadow:0 2px 8px rgba(0,0,0,.04)}'
      + '.adm-af-teamhead{font-weight:900;font-size:13px;letter-spacing:.04em;display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}'
      + '.adm-af-row{display:flex;align-items:center;gap:6px;margin:6px 0;min-width:0}'
      + '.adm-af-lbl{font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;background:#eef2f6;color:#33414d;border-radius:999px;padding:3px 8px;flex:0 0 auto}'
      + '.adm-af-chip{font-size:12px;font-weight:700;background:#f7fafc;border:1px solid #dfe8ee;border-radius:999px;padding:4px 8px;white-space:nowrap;flex:0 0 auto}'
      + '.adm-af-chip--hl{background:linear-gradient(135deg,#e8fff4,#f0faf6);border-color:#bfe7d2;color:#0b4a3a}'
      + '.adm-af-chips{display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;flex:1;min-width:0;padding-bottom:2px}.adm-af-chips::-webkit-scrollbar{display:none}'
      + '.adm-af-ean{font-family:Consolas,monospace;font-size:12px;background:#0b1a2e;color:#c8f0d8;border-radius:6px;padding:3px 6px;letter-spacing:.02em}'
      + '@media(min-width:720px){.adm-af-teamcard{flex:0 0 320px}.adm-af-cards{flex-wrap:wrap;overflow:visible;scroll-snap-type:none}}';
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
    + HTML_CATALOGUE()
    + '<p class="adm-af-note" style="margin-top:8px">💡 Lecture directe : aucune donnée stockée — la piste est créée depuis la fiche Fnac collée (EAN). La piste reste active indéfiniment (plus de fenêtre 15min).</p>';
  }


  function HTML_CATALOGUE(){
    return ''
    + '<div class="adm-af-sec" id="afCatSec">'
    +   '<h4>📚 Ajouter un ouvrage — EAN / Fnac</h4>'
    +   '<p class="small" style="margin:0 0 8px;color:#6e7a84">1. Ouvre la fiche Fnac <b>avec ton magasin choisi</b> (Fnac → <i>Choisir un autre magasin</i>). 2. Copie la page entière (<code>Ctrl+A</code> → <code>Ctrl+C</code>). 3. Colle ci-dessous → <b>Lire la fiche</b>. L’EAN remplit tout seul titre/auteur/éditeur/édition.</p>'
    +   '<div class="adm-af-ligne" style="margin-bottom:6px">'
    +     '<select id="afCatMagasin" class="adm-af-select" style="min-width:160px"><option value="">— magasin —</option></select>'
    +     '<input id="afCatEan" class="adm-af-input" placeholder="EAN 13 chiffres (auto)" style="max-width:150px" inputmode="numeric">'
    +   '</div>'
    +   '<textarea id="afCatPaste" class="adm-af-input" rows="4" style="width:100%" placeholder="Colle ici la page Fnac (HTML ou texte)…"></textarea>'
    +   '<div class="adm-af-ligne" style="margin-top:6px">'
    +     '<button id="afCatLire" class="secondary" type="button">📋 Lire la fiche</button>'
    +     '<button id="afCatGenerer" class="primary" type="button" disabled>⚓ Générer la piste</button>'
    +     '<span class="small" id="afCatMsg" style="color:#6e7a84"></span>'
    +   '</div>'
    +   '<div id="afCatPreview" style="margin-top:8px"></div>'
    +   '<details style="margin-top:6px"><summary class="small" style="cursor:pointer">✏️ Saisie manuelle (si pas de fiche Fnac)</summary>'
    +     '<div class="adm-af-ligne" style="margin-top:6px">'
    +       '<input id="afCatTitre" class="adm-af-input" placeholder="Titre" style="flex:2">'
    +       '<input id="afCatAuteur" class="adm-af-input" placeholder="Auteur (ou Collectif)" style="flex:1">'
    +     '</div>'
    +     '<div class="adm-af-ligne">'
    +       '<input id="afCatEditeur" class="adm-af-input" placeholder="Éditeur" style="flex:1">'
    +       '<input id="afCatEdition" class="adm-af-input" placeholder="Édition ex. 2e édition" style="flex:1">'
    +       '<input id="afCatAnnee" class="adm-af-input" type="number" placeholder="Année" style="max-width:90px">'
    +     '</div>'
    +     '<div class="adm-af-ligne"><button id="afCatManuel" class="secondary" type="button">➕ Créer depuis ces champs</button></div>'
    +   '</details>'
    + '</div>'; 
  }

  // ── Référentiel minimal — 40 mots P1 + 11 mots P2
  var REF_P1 = [
    {w:'NAUTILE'},{w:'ABYSSES'},{w:'EPAVES'},{w:'EQUATEUR'},{w:'OCEANES'},{w:'RECIFAL'},{w:'SOUSMARIN'},{w:'BARQUES'},{w:'PHOQUES'},{w:'CETACES'},{w:'CORAIL'},{w:'MEDUSES'},{w:'OURSINS'},{w:'CRUSTACE'},{w:'BALEINES'},{w:'DAUPHINS'},{w:'REQUINS'},{w:'ANCHOIS'},{w:'SARDINES'},{w:'MOULES'},{w:'HUITRES'},{w:'CREVETTES'},{w:'LANGOUSTE'},{w:'MAREEES'},{w:'COURANTS'},{w:'VAGUES'},{w:'ECUMES'},{w:'ALGUES'},{w:'MANGROVE'},{w:'PROMENADE'},{w:'PHARE'},{w:'MARINIER'},{w:'PIRATES'},{w:'FLIBUSTIER'},{w:'EQUIPAGES'},{w:'MATELOTS'},{w:'CAPITAINE'},{w:'AMIRAUTE'},{w:'CHALUTIER'},{w:'SOUSMARINE'}
  ];
  var REF_P2 = ['STEELBOOK','ECOTAXE','PICKING','ANTISKATING','NEURONAL','RAYTRACING','REASSORT','REPRISE','PLEIADE','DEFROISSEUR','DIAPHRAGME'];
  var EQUIPES = ['NEMO','NAUTILUS','ARONNAX','NEDLAND'];
  function hashString(s){ var h=0; for(var i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; } return h; }
  function motDeHash(h){ if(typeof h!=='number') return null; for(var i=0;i<REF_P1.length;i++){ if(hashString(REF_P1[i].w)===h) return REF_P1[i].w; } return null; }
  function lireTeamDoc(code){
    try{
      if(S() && S().stockage) return S().stockage().lire('teams/'+code);
      if(window.Nautilus && window.Nautilus.getTeam) return window.Nautilus.getTeam(code);
    }catch(e){}
    return Promise.resolve(null);
  }
  function htmlToutesReponses(){
    var p2chips = REF_P2.map(function(w){ return '<span class="adm-af-chip">'+esc(w)+'</span>'; }).join('');
    return ''
    + '<div class="adm-af-sec" id="afEquipesSec">'
    +   '<h4 style="margin:0 0 6px;font-size:13px">Bonnes réponses — par équipe</h4>'
    +   '<p class="small" style="margin:0 0 8px;color:#6e7a84">Glisser horizontalement sur mobile · P1 1 mot/équipe · P2 11 mots · P3 livre+EAN (après déverrouillage).</p>'
    +   '<div id="afTeamCards" class="adm-af-cards">'
    +     EQUIPES.map(function(eq){
            return '<div class="adm-af-teamcard" data-team="'+eq+'">'
              + '<div class="adm-af-teamhead"><span>'+eq+'</span><span class="small" id="afTeamPill-'+eq+'" style="color:#6e7a84">…</span></div>'
              + '<div class="adm-af-row"><span class="adm-af-lbl">P1</span><span class="adm-af-chip adm-af-chip--hl" id="afP1-'+eq+'">—</span><span class="small" style="color:#6e7a84">morse</span></div>'
              + '<div class="adm-af-row"><span class="adm-af-lbl">P2</span><div class="adm-af-chips">'+p2chips+'</div></div>'
              + '<div class="adm-af-row" id="afP3-'+eq+'"><span class="adm-af-lbl">P3</span><span class="small" style="color:#6e7a84">— choisir équipe ci-dessous</span></div>'
              + '</div>';
          }).join('')
    +   '</div>'
    + '</div>';
  }
  function majCartesEquipes(){
    EQUIPES.forEach(function(eq){
      lireTeamDoc(eq).then(function(doc){
        var pill=$('afTeamPill-'+eq); var p1=$('afP1-'+eq);
        if(!doc){ if(pill) pill.textContent='—'; if(p1) p1.textContent='—'; return; }
        var d=doc.data? doc.data() : doc;
        // Firestore via S().stockage returns { _id, ...fields } or direct fields
        var payload = d || doc;
        var h = payload.morseWordHash!=null ? payload.morseWordHash : (payload.data && payload.data.morseWordHash);
        // fallback: payload may be directly the doc data
        if(h==null && payload.morseWordHash!=null) h=payload.morseWordHash;
        var mot = motDeHash(h) || (payload.morseWord || '');
        if(p1) p1.textContent = mot || '—';
        if(pill){
          var members = payload.members ? payload.members.length : (payload.data && payload.data.members ? payload.data.members.length : 0);
          pill.textContent = members ? members+' matelots' : 'vide';
        }
      }).catch(function(){});
    });
    // P3: si session déverrouillée, majCartesP3 sera appelée depuis voirReponses
  }
  function majCarteP3(equipe, secret){
    var el=$('afP3-'+equipe);
    if(!el) return;
    if(!secret || !secret.reponses){ el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small">—</span>'; return; }
    var r=secret.reponses; var lv=secret.livre||{};
    el.innerHTML='<span class="adm-af-lbl">P3</span><span class="adm-af-chip adm-af-chip--hl" title="'+esc(lv.titre||'')+'">'+esc(lv.titre||'?')+'</span> <span class="adm-af-ean">'+esc(r.ean||'')+'</span>';
  }

  function HTML_REP() {
    return ''
    + '<p class="small" style="margin-bottom:8px;color:#6e7a84">Bonnes réponses · P1/P2/P3 — lecture directe Fnac.</p>'
    + htmlToutesReponses()
    + '<div class="adm-af-sec">'
    +   '<h4>📜 Session — réponses P3</h4>'
    +   '<div class="adm-af-ligne">'
    +     '<button id="afRepRefresh" class="secondary" type="button">↻</button>'
    +     '<select id="afRepEquipe" class="adm-af-select" style="flex:1;min-width:160px"><option value="">— équipage —</option></select>'
    +     '<button id="afRepVoir" class="primary" type="button">👁️ Voir</button>'
    +   '</div>'
    +   '<p class="adm-af-note" id="afRepEtat"></p>'
    +   '<div id="afRepBox" style="margin-top:8px"></div>'
    + '</div>'
    + '<div class="adm-af-sec">'
    +   '<h4>📦 Cartouches (hors session)</h4>'
    +   '<div class="adm-af-ligne">'
    +     '<input id="afRepMagasin" class="adm-af-input" placeholder="magasinId ex. cl57" style="max-width:120px">'
    +     '<button id="afRepCartouches" class="secondary" type="button">📋 Lister</button>'
    +   '</div>'
    +   '<div id="afRepCartBox" style="margin-top:8px"></div>'
    + '</div>'
    + '<div class="adm-af-sec" id="afNotesSec">'
    +   '<h4>Notes — mots recherchés</h4>'
    +   '<div class="adm-af-ligne">'
    +     '<select id="afNotesEquipe" class="adm-af-select" style="min-width:120px"><option value="">- équipe -</option><option value="NEMO">NEMO</option><option value="NAUTILUS">NAUTILUS</option><option value="ARONNAX">ARONNAX</option><option value="NEDLAND">NEDLAND</option></select>'
    +     '<button id="afNotesCharger" class="secondary" type="button">Charger</button>'
    +     '<button id="afNotesSauver" class="primary" type="button">Enregistrer</button>'
    +     '<button id="afNotesExporter" class="secondary" type="button">JSON</button>'
    +   '</div>'
    +   '<textarea id="afNotesTexte" class="adm-af-input" rows="3" style="width:100%;margin-top:8px" placeholder="Ex. P3 Atlas EAN"></textarea>'
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
    if (target === ONGLET_REP) { try{ majCartesEquipes(); }catch(e){} refreshEquipes(); }
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

    // --- Réponses (sans phrase — lecture directe)
    var rf = $('afRepRefresh'); if (rf) rf.addEventListener('click', refreshEquipes);
    var vr = $('afRepVoir'); if (vr) vr.addEventListener('click', voirReponses);
    var lc = $('afRepCartouches'); if (lc) lc.addEventListener('click', listerCartouches);
    // --- Catalogue Fnac direct
    var clCat = $('afCatLire'); if (clCat) clCat.addEventListener('click', lireFicheFnac);
    var cg = $('afCatGenerer'); if (cg) cg.addEventListener('click', genererPisteFnac);
    var cm = $('afCatManuel'); if (cm) cm.addEventListener('click', genererPisteManuel);
    var paste = $('afCatPaste'); if (paste) paste.addEventListener('input', function(){ var b=$('afCatGenerer'); if(b) b.disabled=true; }); 
    var selCat = $('afCatMagasin'); if (selCat) selCat.addEventListener('change', function(){ majPreviewMagasin(); });
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

  // ===================== RÉPONSES (sans phrase) =====================
  // Phrase supprimée — lecture directe (voir fnac-lecteur.js côté admin)

  function refreshEquipes(){
    var sel = $('afRepEquipe');
    if (!sel) return;
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
      S().lireCoffre(cid, null).then(function(secret){
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
    var html = ''
    + '<div style="border:1px solid #dfe8ee;border-radius:8px;padding:8px;background:#fbfdff;margin-bottom:8px">'
    +   '<b>'+esc(equipe)+'</b> <span class="small">'+esc(sess.magasinId||'?')+' · '+esc(sess.statut||'?')+' · '+(sess.etapesValidees||[]).length+'/'+eta.length+' · '+esc(String(sess.erreurs||0))+' err</span>'
    +   '<br><span class="small">'+esc(cart.id||'')+' · '+esc(cart.famille||'')+'</span>'
    + '</div>';
    if (secret && secret.reponses) {
      var r = secret.reponses; var livre = secret.livre || {};
      try{ majCarteP3(equipe, secret); }catch(e){}
      html += '<div style="border:1px solid #bfe7d2;border-radius:8px;padding:8px;background:#eefaf4;margin-bottom:8px">'
        +   '<div style="font-weight:800;font-size:13px;color:#0b4a3a">📖 '+esc(livre.titre||'?')+' <span class="small" style="font-weight:400">— '+esc(livre.auteur||'')+'</span></div>'
        +   '<div style="display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap">'
        +     '<span class="adm-af-ean">'+esc(r.ean||'?')+'</span>'
        +     '<button type="button" class="secondary adm-af-mini" data-copy-ean="'+esc(r.ean||'')+'" style="padding:4px 8px">📋</button>'
        +     '<span class="small">'+esc(livre.editeur||'')+'</span>'
        +   '</div>'
        + '</div>';
      html += '<table class="adm-af-table"><thead><tr><th>#</th><th>Réponse</th></tr></thead><tbody>'
        + '<tr><td class="small">1 Hublot</td><td><span class="adm-af-ean">'+esc(r.ean||'?')+'</span></td></tr>'
        + '<tr><td class="small">2 Couv.</td><td><b>'+esc(r.premierMot||'?')+'</b></td></tr>'
        + '<tr><td class="small">3 Sign.</td><td><code>'+esc(r.signature||'?')+'</code></td></tr>'
        + '<tr><td class="small">4 Fort</td><td><code>'+esc(r.codeFinal||'?')+'</code></td></tr>'
        + '</tbody></table>';
    } else {
      html += '<p class="adm-af-note" style="color:#9b1111">🔒 '+esc(errDec||'coffre verrouillé')+'</p>';
      if(cart.indice) html+='<p class="small" style="white-space:pre-wrap;word-break:break-word">'+esc(cart.indice)+'</p>';
    }
    html += '<div class="adm-af-ligne" style="margin-top:8px">'
      + '<button class="secondary adm-af-mini" id="afRepTransmettre" type="button">📤 Indice</button>'
      + '<button class="secondary adm-af-mini" id="afRepIndispo" type="button">🚫 Indispo.</button>'
      + '<button class="danger adm-af-mini" id="afRepReset" type="button">🔄 Reset</button>'
      + '</div><p class="adm-af-note" id="afRepActionMsg"></p>';
    box.innerHTML = html;
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
          S().lireCoffre(cid, null).then(function(sec){
            alert('Cartouche '+cid+'\n\nRéponses :\nEAN: '+(sec.reponses.ean||'')+'\nPremier mot: '+(sec.reponses.premierMot||'')+'\nSignature: '+(sec.reponses.signature||'')+'\nChambre forte: '+(sec.reponses.codeFinal||'')+'\n\nLivre: '+(sec.livre.titre||'')+' — '+(sec.livre.auteur||''));
          }).catch(function(e){ alert('❌ '+ (e.message||e)); });
        });
      });
    }).catch(function(e){ box.innerHTML='<p class="adm-af-note" style="color:#9b1111">❌ '+esc(e.message||e)+'</p>'; });
  }

  // ===================== CATALOGUE — lecture directe Fnac (EAN) =====================
  function majSelectMagasinsCat(){
    var sel = $('afCatMagasin'); if(!sel) return;
    // garde la sélection
    var prev = sel.value;
    var opts = '<option value="">— magasin —</option>';
    if(_liste && _liste.magasins){
      _liste.magasins.filter(function(m){ return m.actif!==false; }).forEach(function(m){
        opts += '<option value="'+esc(m.id)+'">'+esc(m.nom)+' — '+esc(m.ville||'')+' ('+esc(m.id)+')</option>';
      });
    }
    sel.innerHTML = opts;
    if(prev) sel.value = prev;
  }
  function majPreviewMagasin(){
    var mid = ($('afCatMagasin').value||'').trim();
    var msg=$('afCatMsg'); if(msg && mid) msg.textContent='Magasin : '+mid;
  }
  function rendrePreviewLivre(livre, dispo){
    var el=$('afCatPreview'); if(!el) return;
    if(!livre){ el.innerHTML=''; return; }
    var ean = livre.ean || '';
    var dispoHtml = dispo ? '<span class="adm-af-badge '+(dispo.exploitable?'adm-af-badge--ok':'adm-af-badge--warn')+'">'+esc(dispo.etat||dispo.delai||'')+'</span> ' : '';
    el.innerHTML = '<div style="border:1px solid #dfe8ee;border-radius:8px;padding:10px;background:#fbfdff">'
      + '<div style="font-weight:800">'+esc(livre.titre||'—')+'</div>'
      + '<div class="small" style="color:#33414d;margin:2px 0">Auteur: <b>'+esc(livre.auteur||'—')+'</b> · Éditeur: '+esc(livre.editeur||'—')+' · Édition: '+esc(livre.edition||'')+' '+(livre.editionNumero? '('+livre.editionNumero+')':'')+'</div>'
      + '<div style="margin:6px 0"><span class="adm-af-ean">'+esc(ean||'EAN manquant')+'</span> '+dispoHtml+' <span class="small">SKU '+esc(livre.sku||'—')+' · '+esc(livre.annee||'')+'</span></div>'
      + (livre.categorieFnac? '<div class="small">Rayon Fnac: '+esc(livre.categorieFnac)+' · Famille: <b>'+esc(livre.famille||'')+'</b></div>' : '')
      + '</div>';
  }
  function lireFicheFnac(){
    var raw = ($('afCatPaste').value||'');
    var mid = ($('afCatMagasin').value||'').trim();
    var eanInput = ($('afCatEan').value||'').trim();
    if(!raw && !eanInput){ dire('afCatMsg','Colle la page Fnac ou saisis un EAN.','warn'); return; }
    if(!mid){ dire('afCatMsg','Choisis d’abord le magasin (pour valider la dispo).','warn'); return; }
    var FL = window.NautilusFnacLecteur;
    if(!FL || !FL.lireFiche){ dire('afCatMsg','❌ fnac-lecteur.js non chargé sur cette page (ajoute <script src=\"fnac-lecteur.js\">).','danger'); return; }
    // Si seul EAN fourni, on peut quand même tenter (utilise ean comme brut minimal)
    var brut = raw || eanInput;
    try{
      var res = FL.lireFiche(brut, { magasinId: mid, magasins: (_liste && _liste.magasins) || [] });
      if(!res || !res.livre){ dire('afCatMsg','❌ Lecture impossible.','danger'); return; }
      // EAN auto-rempli
      var eL=$('afCatEan'); if(eL) eL.value = res.livre.ean || eanInput || '';
      // Pré-remplit champs manuels
      var t=$('afCatTitre'); if(t) t.value = res.livre.titre || '';
      var a=$('afCatAuteur'); if(a) a.value = res.livre.auteur || '';
      var ed=$('afCatEditeur'); if(ed) ed.value = res.livre.editeur || '';
      var edi=$('afCatEdition'); if(edi) edi.value = res.livre.edition || '';
      var an=$('afCatAnnee'); if(an) an.value = res.livre.annee || '';
      // dispo
      var exploitable = res.exploitable;
      dire('afCatMsg', exploitable ? '✅ Fiche lue — <b>'+esc(res.livre.titre)+'</b> · EAN '+esc(res.livre.ean||'') : '⚠️ Fiche lue mais dispo non exploitable : '+esc(res.motif||'à vérifier'), exploitable?'ok':'warn');
      rendrePreviewLivre(res.livre, res);
      _dernierLivre = res.livre;
      // Active génération si EAN présent
      var bg=$('afCatGenerer'); if(bg) bg.disabled = !res.livre.ean;
      if(!res.livre.ean) dire('afCatMsg','❌ EAN manquant — impossible de générer la piste.','danger');
    }catch(e){
      dire('afCatMsg','❌ '+esc(e.message||e),'danger');
    }
  }
  function genererPisteFnac(){
    if(!_dernierLivre || !_dernierLivre.ean){ dire('afCatMsg','❌ Lis d’abord une fiche avec EAN.','warn'); return; }
    var mid = ($('afCatMagasin').value||'').trim();
    if(!mid){ dire('afCatMsg','Choisis le magasin.','warn'); return; }
    if(!S() || !S().genererCartouche){ dire('afCatMsg','Service non chargé.','danger'); return; }
    dire('afCatMsg','⏳ Génération de la piste…','');
    S().genererCartouche(_dernierLivre, mid, { phrase: null }).then(function(r){
      dire('afCatMsg','✅ Piste créée : <code>'+esc(r.cartouche.id)+'</code> — <b>'+esc(_dernierLivre.titre)+'</b> (EAN '+esc(_dernierLivre.ean)+')','ok');
      rendrePreviewLivre(_dernierLivre, {etat:'piste créée'});
      // Met à jour la liste cartouches si ouverte
      var magInput=$('afRepMagasin'); if(magInput) magInput.value=mid;
    }).catch(function(e){ dire('afCatMsg','❌ '+esc(e.message||e),'danger'); });
  }
  function genererPisteManuel(){
    var mid = ($('afCatMagasin').value||'').trim();
    if(!mid){ dire('afCatMsg','Choisis le magasin.','warn'); return; }
    var ean = ($('afCatEan').value||'').trim().replace(/[^0-9]/g,'');
    if(!ean || ean.length!==13){ dire('afCatMsg','EAN 13 chiffres requis.','warn'); return; }
    var livre = {
      id: 'manuel-'+ean,
      titre: ($('afCatTitre').value||'').trim() || 'Ouvrage '+ean,
      auteur: ($('afCatAuteur').value||'').trim(),
      auteurType: ($('afCatAuteur').value||'').toLowerCase().indexOf('collectif')>=0 ? 'collectif' : 'unique',
      editeur: ($('afCatEditeur').value||'').trim(),
      edition: ($('afCatEdition').value||'').trim(),
      editionNumero: parseInt(($('afCatEdition').value||'').replace(/[^0-9]/g,''),10)||0,
      annee: parseInt(($('afCatAnnee').value||'').trim(),10)||0,
      ean: ean,
      sku: '',
      categorieFnac: '',
      liens: [],
      disponibilite: {}
    };
    livre.disponibilite[mid] = { statut:'disponible', delai:'Retrait gratuit sous 1H', checkedAt: new Date().toISOString(), vendeur:'fnac', magasin: mid };
    _dernierLivre = livre;
    rendrePreviewLivre(livre, {etat:'saisie manuelle'});
    var bg=$('afCatGenerer'); if(bg) bg.disabled=false;
    dire('afCatMsg','✏️ Livre manuel prêt — clique <b>Générer la piste</b>.','ok');
  }

  // Après chargement liste magasins, remplit aussi le select catalogue
  var _oldRendreMag = rendreMag;
  rendreMag = function(){
    _oldRendreMag();
    try{ majSelectMagasinsCat(); }catch(e){}
  };

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
