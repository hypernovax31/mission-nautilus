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
  function ensureTabsCss(){
    if(document.getElementById('nautilusAdminTabsFix')) return;
    var st=document.createElement('style');
    st.id='nautilusAdminTabsFix';
    st.textContent='.admin-tabs{display:flex;flex-wrap:nowrap;gap:4px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:4px}.admin-tabs::-webkit-scrollbar{display:none}.admin-tab{flex:0 0 auto;white-space:nowrap;min-width:36px;justify-content:center}.admin-pane{min-width:0;overflow-wrap:anywhere;max-width:100%}#adminPanel .body{overflow-x:hidden}'
      + '.adm-af-cards{display:flex;flex-direction:column;gap:12px;padding:6px 2px 8px;overflow:visible}'
      + '.adm-af-teamcard{flex:0 0 auto;width:100%;max-width:none;min-width:0;background:#fff;border:1px solid #dfe8ee;border-radius:12px;padding:10px;box-shadow:0 2px 8px rgba(0,0,0,.04)}'
      + '.adm-af-teamhead{font-weight:900;font-size:13px;letter-spacing:.04em;display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}'
      + '.adm-af-row{display:flex;align-items:center;gap:6px;margin:6px 0;min-width:0}'
      + '.adm-af-lbl{font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;background:#eef2f6;color:#33414d;border-radius:999px;padding:3px 8px;flex:0 0 auto}'
      + '.adm-af-chip{font-size:12px;font-weight:700;background:#f7fafc;border:1px solid #dfe8ee;border-radius:999px;padding:4px 8px;white-space:nowrap;flex:0 0 auto}'
      + '.adm-af-chip--hl{background:linear-gradient(135deg,#e8fff4,#f0faf6);border-color:#bfe7d2;color:#0b4a3a}'
      + '.adm-af-chips{display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;flex:1;min-width:0;padding-bottom:2px}.adm-af-chips::-webkit-scrollbar{display:none}'
      + '.adm-af-ean{font-family:Consolas,monospace;font-size:12px;background:#0b1a2e;color:#c8f0d8;border-radius:6px;padding:3px 6px;letter-spacing:.02em}'
      + '@media(min-width:720px){.adm-af-cards{gap:14px}.adm-af-teamcard{padding:12px}}'
      + '.adm-qr-grid{display:grid;grid-template-columns:1fr;gap:14px;margin-top:10px}'
      + '.adm-qr-card{background:#fff;border:1px solid #dfe8ee;border-radius:12px;padding:10px;box-shadow:0 2px 8px rgba(0,0,0,.04)}'
      + '.adm-qr-card h5{margin:0 0 6px;font-size:13px;font-weight:900}'
      + '.adm-qr-imgs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}'
      + '.adm-qr-imgbox{background:#f6f8fb;border:1px solid #dfe8ee;border-radius:8px;padding:6px;text-align:center}'
      + '.adm-qr-imgbox img{width:100%;height:auto;display:block;border-radius:6px}'
      + '.adm-qr-dl{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}'
      + '.adm-qr-dl a{flex:1;min-width:110px;text-align:center;background:#0b1a2e;color:#fff;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;text-decoration:none}'
      + '.adm-qr-dl a:nth-child(2){background:#f5b027;color:#0b1a2e}'
      + '@media(min-width:720px){.adm-qr-grid{grid-template-columns:1fr 1fr}}';
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
    + '<p class="small" style="margin-bottom:10px">Liste des <b>magasins Fnac</b>. Source : <code>data/magasins-fnac.json</code> (ou Firestore si publiée plus récemment).</p>'
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
    + '</div>';
  }


  // ── Référentiel minimal — 40 mots P1 + 11 mots P2
  var REF_P1 = [
    {w:'NAUTILE'},{w:'ABYSSES'},{w:'EPAVES'},{w:'EQUATEUR'},{w:'OCEANES'},{w:'RECIFAL'},{w:'SOUSMARIN'},{w:'BARQUES'},{w:'PHOQUES'},{w:'CETACES'},{w:'CORAIL'},{w:'MEDUSES'},{w:'OURSINS'},{w:'CRUSTACE'},{w:'BALEINES'},{w:'DAUPHINS'},{w:'REQUINS'},{w:'ANCHOIS'},{w:'SARDINES'},{w:'MOULES'},{w:'HUITRES'},{w:'CREVETTES'},{w:'LANGOUSTE'},{w:'MAREEES'},{w:'COURANTS'},{w:'VAGUES'},{w:'ECUMES'},{w:'ALGUES'},{w:'MANGROVE'},{w:'PROMENADE'},{w:'PHARE'},{w:'MARINIER'},{w:'PIRATES'},{w:'FLIBUSTIER'},{w:'EQUIPAGES'},{w:'MATELOTS'},{w:'CAPITAINE'},{w:'AMIRAUTE'},{w:'CHALUTIER'},{w:'SOUSMARINE'}
  ];
  var REF_P2 = ['STEELBOOK','ECOTAXE','PICKING','ANTISKATING','NEURONAL','RAYTRACING','REASSORT','REPRISE','PLEIADE','DEFROISSEUR','DIAPHRAGME'];
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
      el.title = ok ? 'Découvert par l\'équipage' : '';
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
        });
      }, function(){ /* lecture indisponible */ });
    }).catch(function(){});
  }

  function htmlToutesReponses(){
    // UN SEUL CARD — toutes les équipes regroupées (plus de cards TEST séparées)
    return ''
    + '<div class="adm-af-sec" id="afEquipesSec">'
    +   '<h4 style="margin:0 0 6px;font-size:13px">BONNES RÉPONSES — TOUTES ÉQUIPES</h4>'
    +   '<p class="small" style="margin:0 0 8px;color:#6e7a84">P1 1 mot/équipe · P2 11 mots · P3 livre + EAN + sceau, couverture, signature, chambre forte • P4….</p>'
    +   '<div id="afTeamCards" class="adm-af-cards">'
    +     '<div class="adm-af-teamcard" id="afSingleCard" data-team="ALL" style="border:1px solid #0b1a2e;background:#fff">'
    +       '<div class="adm-af-teamhead"><span>🔑 RÉPONSES</span><span class="small" id="afGlobalPill" style="color:#6e7a84">chargement…</span></div>'
    +       EQUIPES.map(function(eq){
            var p2 = REF_P2.map(function(w){ return '<span class="adm-af-chip" id="afP2-'+eq+'-'+w+'">'+esc(w)+'</span>'; }).join('');
            return '<div class="adm-af-teamcard" data-team="'+eq+'" style="margin:10px 0 0;padding:10px 10px 8px;background:#f7fafc;border:1px solid #e3eaf0;border-radius:10px;box-shadow:none">'
              + '<div class="adm-af-teamhead" style="font-size:12px"><span>'+eq+'</span><span class="small" id="afTeamPill-'+eq+'" style="color:#6e7a84">…</span></div>'
              + '<div class="adm-af-row"><span class="adm-af-lbl">P1</span><span class="adm-af-chip adm-af-chip--hl" id="afP1-'+eq+'">—</span><span class="small" style="color:#6e7a84">morse</span></div>'
              + '<div class="adm-af-row"><span class="adm-af-lbl">P2</span><div class="adm-af-chips" id="afP2wrap-'+eq+'">'+p2+'</div></div>'
              + '<div class="adm-af-row" id="afP3-'+eq+'"><span class="adm-af-lbl">P3</span><span class="small" style="color:#6e7a84">chargement…</span></div>'
              + '</div>';
          }).join('')
    +     '</div>'
    +   '</div>'
    + '</div>';
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
        if(p1) p1.textContent = mot || '—';
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
        if(!doc && !mot){
           // même sans doc, on tente quand même P2 via local déjà fait
        }
      }).catch(function(){
        // Firestore erreur → fallback local
        try{
          var mLocal = lireP1DepuisLocal(eq);
          var p1b=$('afP1-'+eq); if(p1b) p1b.textContent = mLocal || '—';
          var l2 = lireP2DepuisLocal(eq);
          if(l2) majP2Chips(eq, l2); else majP2Chips(eq, []);
        }catch(e){ try{ majP2Chips(eq, []);}catch(e2){} }
      });
      majCarteP3Auto(eq);
    });
    // MODE_TEST supprimé — un seul card regroupe toutes les réponses (demande admin)
    // (cards TEST dynamiques supprimées — un seul card suffit)
    // mise à jour du compteur global du card unique
    try{
      var gp=$('afGlobalPill');
      if(gp){
        var done=0;
        EQUIPES.forEach(function(eq){
          var p1e=$('afP1-'+eq);
          if(p1e && p1e.textContent && p1e.textContent.trim()!=='—' && p1e.textContent.trim()!=='') done++;
        });
        gp.textContent = done + '/' + EQUIPES.length + ' équipes renseignées';
      }
    }catch(e){}
    try{ ecouterP2Live(); }catch(e){}
  }
  function majCarteP3Auto(equipe){
    var el=$('afP3-'+equipe);
    if(!el) return;
    el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small" style="color:#6e7a84">chargement…</span>';
    function afficherPasDeSession(msg){
      // on tente un dernier recours : afficher la cartouche si elle existe déjà dans le DOM ou via lecture directe Firestore
      el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small" style="color:#6e7a84">'+esc(msg || '— pas de session')+'</span>';
    }
    function lireSecretLocalStorage(cid){
      try{
        var raw = localStorage.getItem('nautilusP3Secret_'+cid);
        if(raw){ var j=JSON.parse(raw); if(j && j.reponses) return j; if(j && j.secret && j.secret.reponses) return j.secret; }
      }catch(e){}
      try{
        var agg = localStorage.getItem('nautilusP3ApercuSecrets');
        if(agg){ var m=JSON.parse(agg); if(m && m[cid] && m[cid].reponses) return m[cid]; if(m && m[cid] && m[cid].secret) return m[cid].secret || m[cid]; }
      }catch(e){}
      try{
        var t2 = localStorage.getItem('nautilusP3TestSecrets');
        if(t2){ var m2=JSON.parse(t2); if(m2 && m2[cid]) return m2[cid].reponses ? m2[cid] : m2[cid].secret || m2[cid]; }
      }catch(e){}
      try{
        var all = localStorage.getItem('nautilusP3SessionSecrets');
        if(all){ var mm=JSON.parse(all); for(var k in mm){ if(mm[k] && mm[k].cartoucheId===cid && mm[k].secret) return mm[k].secret; if(mm[k] && mm[k].secret && mm[k].secret.reponses) return mm[k].secret; } }
      }catch(e){}
      return null;
    }
    function lireCoffreRobuste(cid){
      var local = lireSecretLocalStorage(cid);
      if(local && local.reponses) return Promise.resolve(local);
      var viaServicePhrases = [];
      if(S() && S().lireCoffre){
        viaServicePhrases.push(function(){ return S().lireCoffre(cid, null).catch(function(){ return null; }); });
        viaServicePhrases.push(function(){ return S().lireCoffre(cid, 'NEMO2026').catch(function(){ return null; }); });
        viaServicePhrases.push(function(){ return S().lireCoffre(cid, '').catch(function(){ return null; }); });
      }
      var chain = Promise.resolve(null);
      viaServicePhrases.forEach(function(fn){
        chain = chain.then(function(prev){ if(prev && prev.reponses) return prev; return fn().then(function(cur){ return cur || prev; }); });
      });
      if(!viaServicePhrases.length) chain = Promise.resolve(null);
      return chain.then(function(secret){
        if(secret && secret.reponses) return secret;
        var fromLocal = lireSecretLocalStorage(cid);
        if(fromLocal && fromLocal.reponses) return fromLocal;
        if(window.NautilusBlocages && window.NautilusBlocages.db){
          return window.NautilusBlocages.db().then(function(x){
            return x.fs.getDoc(x.fs.doc(x.db, 'coffres', cid)).then(function(snap){
              if(snap.exists()){
                var d=snap.data()||{};
                if(d.secret && d.secret.reponses) return d.secret;
                if(d.secret && d.enClair) return d.secret;
                if(d.coffre){
                  var phrases = [null,'NEMO2026',''];
                  var pChain = Promise.resolve(null);
                  phrases.forEach(function(ph){
                    pChain = pChain.then(function(pr){ if(pr && pr.reponses) return pr; if(S() && S().dechiffrer) return S().dechiffrer(d.coffre, ph).then(function(dec){ return dec && dec.reponses ? dec : pr; }).catch(function(){ return pr; }); return pr; });
                  });
                  return pChain.then(function(decoded){ if(decoded && decoded.reponses) return decoded; return secret || fromLocal; });
                }
              }
              return secret || fromLocal;
            }).catch(function(){ return secret || fromLocal; });
          }).catch(function(){ return secret || fromLocal; }).then(function(got){
            if(got && got.reponses) return got;
            var loc2 = lireSecretLocalStorage(cid);
            return loc2 || got;
          });
        }
        return secret || fromLocal;
      });
    }
    function lireSessionLocale(eq){
      try{
        // MODE_TEST = alias visuel qui agrège APERCU/TEST/ANON
        if(eq==='MODE_TEST'){
          for(var _k=0; _k<['APERCU','TEST','ANON','MODE_TEST'].length; _k++){
            var cand=_k===3? eq : ['APERCU','TEST','ANON'][_k];
            var ra2=localStorage.getItem('nautilusP3Session_'+cand);
            if(ra2){ try{ var s2=JSON.parse(ra2); if(s2 && s2.cartoucheId) return s2; }catch(e){} }
          }
          // aussi via aggregates
          try{
            var agg2=localStorage.getItem('nautilusP3SessionSecrets');
            if(agg2){ var m2=JSON.parse(agg2); for(var kk in m2){ if(m2[kk] && m2[kk].cartoucheId){ if(kk==='APERCU' || kk==='TEST' || kk==='ANON') return m2[kk]; } } }
          }catch(e){}
          try{
            var aggA=localStorage.getItem('nautilusP3ApercuSecrets');
            if(aggA){ var ma=JSON.parse(aggA); for(var kka in ma){ if(ma[kka] && ma[kka].cartoucheId) return ma[kka]; if(ma[kka] && ma[kka].secret) return {cartoucheId:kka, cartouche:ma[kka]}; } }
          }catch(e){}
        }
        var raw = localStorage.getItem('nautilusP3Session_'+eq);
        if(raw){ var s=JSON.parse(raw); if(s && s.cartoucheId) return s; }
        var agg = localStorage.getItem('nautilusP3SessionSecrets');
        if(agg){ var m=JSON.parse(agg); if(m && m[eq] && m[eq].cartoucheId) return m[eq]; if(m && m[eq] && m[eq].session && m[eq].session.cartoucheId) return m[eq].session; }
        var cur = localStorage.getItem('nautilusP3CurrentSession');
        if(cur){ var c=JSON.parse(cur); if(c && c.equipe===eq && c.cartoucheId) return c; }
        // dernier recours : chercher toute clé nautilusP3Secret_* avec équipe correspondante
        for(var i=0;i<localStorage.length;i++){
          var k=localStorage.key(i);
          if(k && k.indexOf('nautilusP3Session')===0){
            try{ var v=JSON.parse(localStorage.getItem(k)); if(v && v.equipe===eq && v.cartoucheId) return v; }catch(e){}
          }
        }
      }catch(e){}
      return null;
    }
    function lireSessionRobuste(eq){
      // 1) via le service artefact (peut être en mémoire si page en aperçu)
      var viaService = (S() && S().lireSession) ? S().lireSession(eq).catch(function(){ return null; }) : Promise.resolve(null);
      return viaService.then(function(sess){
        if(sess && sess.cartoucheId) return sess;
        var loc = lireSessionLocale(eq);
        if(loc && loc.cartoucheId) return loc;
        // 2) fallback Firestore direct (NautilusBlocages est toujours en Firestore, même en mode aperçu)
        if(window.NautilusBlocages && window.NautilusBlocages.db){
          return window.NautilusBlocages.db().then(function(x){
            return x.fs.getDoc(x.fs.doc(x.db, 'sessions', eq)).then(function(snap){
              if(snap.exists()){
                var d = snap.data() || null;
                if(d && d.cartoucheId) return d;
                // certains anciens déploiements stockaient sous teams/{eq} artefactSession
                if(d && d.cartouche && d.cartouche.id) return d;
              }
              var loc2 = lireSessionLocale(eq);
              if(loc2 && loc2.cartoucheId) return loc2;
              return sess || loc2;
            }).catch(function(){ var loc3=lireSessionLocale(eq); return loc3 || sess; });
          }).catch(function(){ return sess; });
        }
        return sess;
      });
    }
    if(!S() || !S().lireSession || !S().lireCoffre){
      // même sans service, on tente le fallback Firestore
      lireSessionRobuste(equipe).then(function(sess){
        if(!sess || !sess.cartoucheId){
          // on tente aussi via teams/{eq} si sessions/{eq} vide (compat)
          if(window.NautilusBlocages && window.NautilusBlocages.db){
            window.NautilusBlocages.db().then(function(x){
              return x.fs.getDoc(x.fs.doc(x.db, 'teams', equipe)).then(function(snap){
                if(snap.exists()){
                  var td = snap.data()||{};
                  // si le palier 3 a laissé une trace dans le team doc
                  var cand = td.artefactSession || td.p3Session || td.sessionP3 || null;
                  if(cand && cand.cartoucheId){
                    var cid2=cand.cartoucheId;
                    return lireCoffreRobuste(cid2).then(function(secret){
                      if(secret && secret.reponses) majCarteP3(equipe, secret);
                      else el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small" style="color:#6e7a84">cartouche '+esc(String(cid2).slice(0,10))+'… (coffre indisponible)</span>';
                    }).catch(function(){
                      el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small" style="color:#6e7a84">cartouche '+esc(String(cid2).slice(0,10))+'… (coffre indisponible)</span>';
                    });
                  }
                }
                afficherPasDeSession('— pas de session');
              });
            }).catch(function(){ afficherPasDeSession('— pas de session'); });
          } else {
            afficherPasDeSession('— pas de session');
          }
          return;
        }
        var cid = sess.cartoucheId;
        return lireCoffreRobuste(cid).then(function(secret){
          if(secret && secret.reponses) majCarteP3(equipe, secret);
          else if(sess.cartouche && sess.cartouche.id) el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small" style="color:#6e7a84">cartouche '+esc(String(sess.cartouche.id).slice(0,10))+'… (coffre indisponible)</span>';
          else if(cid) el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small" style="color:#6e7a84">cartouche '+esc(String(cid).slice(0,10))+'…</span>';
          else el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small">—</span>';
        }).catch(function(){
          var cart = sess.cartouche;
          if(cart && cart.id){
            el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small" style="color:#6e7a84">cartouche '+esc(String(cart.id).slice(0,10))+'… (coffre indisponible)</span>';
          }else if(cid){
            el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small" style="color:#6e7a84">cartouche '+esc(String(cid).slice(0,10))+'…</span>';
          }else{
            el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small">—</span>';
          }
        });
      });
      return;
    }
    lireSessionRobuste(equipe).then(function(sess){
      if(!sess || !sess.cartoucheId){
        // idem : on vérifie teams/{eq} en dernier recours avant d'abandonner
        if(window.NautilusBlocages && window.NautilusBlocages.db){
          return window.NautilusBlocages.db().then(function(x){
            return x.fs.getDoc(x.fs.doc(x.db, 'teams', equipe)).then(function(snap){
              if(snap.exists()){
                var td2=snap.data()||{};
                var cand2=td2.artefactSession||td2.p3Session||null;
                if(cand2 && cand2.cartoucheId) return cand2;
              }
              afficherPasDeSession('— pas de session');
              return null;
            });
          }).then(function(cand){
            if(!cand) return;
            var cid2=cand.cartoucheId;
            return lireCoffreRobuste(cid2).then(function(secret){
              if(secret && secret.reponses) majCarteP3(equipe, secret);
              else el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small" style="color:#6e7a84">cartouche '+esc(String(cid2).slice(0,10))+'… (coffre indisponible)</span>';
            }).catch(function(){
              el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small" style="color:#6e7a84">cartouche '+esc(String(cid2).slice(0,10))+'… (coffre indisponible)</span>';
            });
          });
        }
        afficherPasDeSession('— pas de session');
        return;
      }
      var cid = sess.cartoucheId;
      return lireCoffreRobuste(cid).then(function(secret){
        if(secret && secret.reponses) majCarteP3(equipe, secret);
        else if(sess.cartouche && sess.cartouche.id) el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small" style="color:#6e7a84">cartouche '+esc(String(sess.cartouche.id).slice(0,10))+'… (coffre indisponible)</span>';
        else if(cid) el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small" style="color:#6e7a84">cartouche '+esc(String(cid).slice(0,10))+'…</span>';
        else el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small">—</span>';
      }).catch(function(){
        var cart = sess.cartouche;
        if(cart && cart.id){
          el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small" style="color:#6e7a84">cartouche '+esc(String(cart.id).slice(0,10))+'… (coffre indisponible)</span>';
        }else if(cid){
          el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small" style="color:#6e7a84">cartouche '+esc(String(cid).slice(0,10))+'…</span>';
        }else{
          el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small">—</span>';
        }
      });
    }).catch(function(){
      afficherPasDeSession('— pas de session');
    });
  }
  function majCarteP3(equipe, secret){
    var el=$('afP3-'+equipe);
    if(!el) return;
    if(!secret || !secret.reponses){ el.innerHTML='<span class="adm-af-lbl">P3</span><span class="small">—</span>'; return; }
    var r=secret.reponses; var lv=secret.livre||{};
    // toutes les réponses attendues : titre + EAN + cartouche final (signature + chambre forte)
    var premier = r.premierMot || '';
    var signature = r.signature || '';
    var codeFinal = r.codeFinal || '';
    var fragments = secret.fragments || null;
    var ordre = secret.ordre || '';
    var regle = secret.regle || '';
    var html = '<span class="adm-af-lbl">P3</span><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">';
    html += '<span class="adm-af-chip adm-af-chip--hl" title="'+esc(lv.titre||'')+'">📖 '+esc(lv.titre||'?')+'</span>';
    html += '<span class="adm-af-ean">'+esc(r.ean||'')+'</span>';
    if(codeFinal) html += '<span class="adm-af-chip" style="background:#0b1a2e;color:#fff" title="Chambre forte — code final">🔐 '+esc(codeFinal)+'</span>';
    html += '</div>';
    // détails compacts des 4 étapes
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;font-size:11px;line-height:1.3">';
    if(premier) html += '<span style="background:#f0f7ff;border:1px solid #c8daf0;border-radius:6px;padding:3px 6px"><b style="color:#0b3a5e">Couverture:</b> '+esc(premier)+'</span>';
    if(signature) html += '<span style="background:#fff7e6;border:1px solid #f0d0a0;border-radius:6px;padding:3px 6px"><b style="color:#6e3a0a">Signature:</b> '+esc(signature)+' <span style="opacity:.7">('+esc(regle||'')+')</span></span>';
    if(lv.auteur) html += '<span style="background:#f6f8fb;border:1px solid #dfe8ee;border-radius:6px;padding:3px 6px"><b>Auteur:</b> '+esc(lv.auteur)+'</span>';
    if(lv.editeur) html += '<span style="background:#f6f8fb;border:1px solid #dfe8ee;border-radius:6px;padding:3px 6px"><b>Éditeur:</b> '+esc(lv.editeur)+'</span>';
    html += '</div>';
    if(fragments){
      var fragTxt = [];
      if(fragments.lettresPremierMot) fragTxt.push('A:'+esc(fragments.lettresPremierMot));
      if(fragments.initialeSignature) fragTxt.push('B:'+esc(fragments.initialeSignature));
      if(fragments.editionNumero) fragTxt.push('C:'+esc(fragments.editionNumero));
      if(fragments.derniereLettreEditeur) fragTxt.push('D:'+esc(fragments.derniereLettreEditeur));
      if(fragTxt.length) html += '<div class="small" style="color:#6e7a84;margin-top:2px">Fragments '+fragTxt.join(' · ')+' · Ordre '+esc(ordre)+'</div>';
    }
    if(lv.id) html += '<div class="small" style="color:#9aa8b6;font-family:Consolas,monospace">'+esc(lv.id)+' · '+esc(secret.cartoucheId||'')+'</div>';
    html += '</div>';
    el.innerHTML = html;
    el.style.alignItems = 'flex-start';
  }

  function HTML_REP() {
    return ''
    + '<p class="small" style="margin-bottom:8px;color:#6e7a84">P1 1 mot/équipe · P2 11 mots · P3 livre + EAN + sceau, couverture, signature, chambre forte • P4….</p>'
    + htmlToutesReponses();
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
    +   '<p class="small" style="margin-bottom:8px"><a href="'+planche+'" download="planche-qr-nautilus.png" style="background:#0b1a2e;color:#fff;border-radius:999px;padding:6px 14px;text-decoration:none;font-weight:700;display:inline-block">⬇️ Télécharger la planche (2020×6600 px)</a> <span style="margin-left:8px;color:#6e7a84">12 QR étiquetés</span></p>'
    +   '<a href="'+planche+'" download="planche-qr-nautilus.png" style="display:block;max-width:720px;border:1px solid #dfe8ee;border-radius:10px;overflow:hidden"><img src="'+planche+'" alt="Planche QR Nautilus" style="width:100%;height:auto;display:block" loading="lazy"></a>'
    + '</div>'
    + '<div class="adm-qr-grid">';
    QR_PALIERS.forEach(function(p){
      var noir = 'assets/qr/QR-palier-'+p.n+'_noir-sur-blanc.png';
      var jaune = 'assets/qr/QR-palier-'+p.n+'_jaune-sur-noir.png';
      html += ''
      + '<div class="adm-qr-card">'
      +   '<h5>Palier '+p.n+' — <code>'+esc(p.code)+'</code> <span style="font-weight:400;color:#6e7a84">→ '+esc(p.page)+'</span></h5>'
      +   '<div class="adm-qr-imgs">'
      +     '<div class="adm-qr-imgbox"><div class="small" style="font-weight:700;margin-bottom:4px">Noir sur blanc</div><img src="'+noir+'" alt="QR palier '+p.n+' noir" loading="lazy"><div class="small" style="color:#6e7a84;margin-top:4px">Impression standard</div></div>'
      +     '<div class="adm-qr-imgbox" style="background:#020812;border-color:#1a2a3a"><div class="small" style="font-weight:700;margin-bottom:4px;color:#f5b027">Jaune sur noir</div><img src="'+jaune+'" alt="QR palier '+p.n+' jaune" loading="lazy"><div class="small" style="color:#8ee7ff;margin-top:4px">Ambiance Nautilus</div></div>'
      +   '</div>'
      +   '<div class="adm-qr-dl">'
      +     '<a href="'+noir+'" download="QR-palier-'+p.n+'_noir-sur-blanc.png">⬇️ Noir / blanc</a>'
      +     '<a href="'+jaune+'" download="QR-palier-'+p.n+'_jaune-sur-noir.png">⬇️ Jaune / noir</a>'
      +   '</div>'
      +   '<p class="small" style="color:#6e7a84;margin-top:6px">Logo Nautilus au centre · correction H (30 %) · testé jsQR</p>'
      + '</div>';
    });
    html += '</div>'
    + '<p class="small" style="margin-top:12px;color:#6e7a84">Taille conseillée ≥ 6×6 cm, ne pas rogner la zone de silence. La variante jaune est un QR inversé — testée avec l’app (jsQR <code>inversionAttempts:both</code>). En cas de doute, imprime la variante noire. Régénération : <code>python3 tools/generate_qr.py</code>.</p>';
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
    btnRep.innerHTML = '<span class="lbl-desktop">🔑 Réponses</span><span class="lbl-mobile" aria-label="Réponses">🔑</span>';
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
    if (target === ONGLET_REP) { try{ majCartesEquipes(); }catch(e){} }
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

    // --- Réponses : cartes auto (aucun bouton manuel) — le livre est lu depuis la session de chaque équipe
    // Pas de copie EAN manuelle : l’EAN est visible dans la carte P3 de chaque équipe
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
