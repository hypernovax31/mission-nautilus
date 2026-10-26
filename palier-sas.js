/* =============================================================
   SAS D'ACCÈS « ZONE SCELLÉE » — CODE COMMUN À TOUS LES PALIERS ≥ 2
   (palier-sas.js)

   RÈGLE ABSOLUE : avant d'entrer sur la page d'un palier 2, 3, 4…
   (tous SAUF le Palier 1, qui reste libre), la page affiche
   « 🔒 ZONE SCELLÉE » et le mini-jeu reste VERROUILLÉ tant que le
   QR Code de la zone de recherche n'a pas été validé. Sans QR,
   personne ne joue. Le QR livre le « numéro secret » du palier, qui
   seul lève le scellé (saisie manuelle possible en secours).

   Le code attendu se reconstitue EXACTEMENT comme dans le moteur du
   jeu : « PALIER » = P(16) A(1) L(12) I(9) E(5) R(18), palier n →
   +(n−1) sur chaque chiffre, chiffres collés = nom du fichier de la
   page (palier 2 → 1721310619.html, palier 3 → 1831411720.html…).

   BLOC HTML ATTENDU (identique sur chaque page de palier ≥ 2) :

     <div class="topbar-title" id="topPalierTitle">Palier n</div>
     <section class="card gate-hero" id="gateHero">
       <h2 id="sasHeroTitle">🔒 PALIER n — ZONE SCELLÉE</h2> …
     </section>
     <section class="card" id="logCard">… journal de bord …</section>
     <section class="card" id="gateCard">… QR / photo …</section>
     <section class="card" id="briefCard" hidden>
       <div class="body"><div id="briefHost"></div></div>
     </section>
     <section class="card gate-unlocked" id="gateUnlocked" hidden>
       <h2 id="sasUnlockedTitle">✅ PALIER n</h2> …
     </section>
     … tout le contenu du mini-jeu porte class="sas-protege" …

   Garanties apportées par ce module (et le script de la page) :
     • tant que la zone est réellement scellée (en attente du QR
       Code), « 🔒 PALIER n — ZONE SCELLÉE », le journal de bord et le
       sas QR sont à l'écran — le mini-jeu reste VERROUILLÉ ;
     • dès que le sas est ouvert (scan réussi, sas déjà mémorisé,
       aperçu admin), la page bascule sur la VUE BRIEFING DU CAPITAINE
       (palier-briefing.js — explication immersive du thème, SANS
       dévoiler le contenu, mise en page du Palier 1) : vue
       OBLIGATOIRE entre la ZONE SCELLÉE et le mini-jeu sur TOUS les
       paliers de la mission (Palier 2 → final) — son bouton
       « ⚓ PRENDRE LES COMMANDES » mène à la VUE ÉPREUVE, où SEUL
       l'encart du mini-jeu reste ;
     • tant que le sas est fermé, tout élément .sas-protege reste
       caché : IMPOSSIBLE de toucher au mini-jeu ;
     • déblocage = QR caméra, ou PHOTO du QR importée ;
     • une fois ouvert, on le mémorise sur l'appareil
       (localStorage), l'équipage n'a pas à refaire le scan à chaque
       visite — la page rejoint alors DIRECTEMENT le briefing du
       capitaine, sans repasser par le sas ;
     • chaque événement est consigné dans le JOURNAL DE BORD commun
       (journal-bord.js, « Activité en direct »), consultable sur les
       vues d'avant-partie (scellée, briefing) et dès que l'épreuve
       s'arrête.

   Utilisation : <script src="palier-sas.js?v=10"></script>
                 <script>NautilusSas.init(2);</script>   // n = palier
   ============================================================= */
(function () {
  'use strict';

  var BASE = [16, 1, 12, 9, 5, 18];      // P A L I E R
  var STEPS_ORDER = ['start','livres','son','zone51','occasion','papeterie','drone','final'];
  function palierStepId(p){ return STEPS_ORDER[(p|0)-1] || null; }
  function teamHasPassedPalier(teamData, palierNum){
    if(!teamData) return false;
    var stepId = palierStepId(palierNum);
    if(!stepId) return false;
    var completed = teamData.completedSteps || [];
    if(completed.indexOf(stepId) !== -1) return true;
    var cur = teamData.currentStep;
    if(!cur) return false;
    var curIdx = STEPS_ORDER.indexOf(cur);
    var palIdx = STEPS_ORDER.indexOf(stepId);
    if(curIdx > palIdx) return true;
    // si currentStep est exactement ce palier mais sas déjà ouvert, on considère briefing dû
    // (le sasUnlocks sera vérifié séparément)
    return false;
  }
  var NOMS_EQUIPAGES = { NEMO: 'Nemo', NAUTILUS: 'Nautilus', ARONNAX: 'Aronnax', NEDLAND: 'Ned Land' };

  function init(palier) {
    var n = Math.max(2, palier | 0);              // le sas ne concerne que les paliers ≥ 2
    var LABEL = 'Palier ' + n;
    var CODE_CHIFFRES = BASE.map(function (x) { return String(x + (n - 1)); }).join('');
    var UNLOCK_KEY = 'nautilusUnlock:palier:' + CODE_CHIFFRES;

    var $ = function (id) { return document.getElementById(id); };

    /* Journal de bord commun (« Activité en direct »), s'il est chargé. */
    function journal(texte, kind) {
      if (window.JournalDeBord) window.JournalDeBord.addLogEntry(texte, kind || 'info');
    }

    /* ---------- Titres du héros « ZONE SCELLÉE » et du portail ----------
       Le héros (et le sas) ne restent À L'ÉCRAN que tant que la zone
       est réellement scellée : c'est le script de la page qui les
       range dès que la vue « épreuve » prend le relais (scan réussi,
       sas mémorisé, aperçu admin). */
    document.title = 'Mission Nautilus — ' + LABEL;
    if ($('topPalierTitle')) $('topPalierTitle').textContent = LABEL;
    if ($('sasHeroTitle')) $('sasHeroTitle').textContent = '🔒 ' + LABEL.toUpperCase() + ' — ZONE SCELLÉE';
    /* Titre de l'épreuve EN MODE JEU : « ✅ PALIER n » tout court — le
       mot « DÉVERROUILLÉ » a été supprimé (demande explicite : une fois
       qu'on joue, plus rien à déverrouiller à l'écran). */
    if ($('sasUnlockedTitle')) $('sasUnlockedTitle').textContent = '✅ ' + LABEL.toUpperCase();

    /* ---------- Verrouillage du contenu protégé ----------
       Tant que le sas est fermé, tout élément .sas-protege (le futur
       mini-jeu) est gardé hors de portée. */
    function cacherContenuProtege() {
      var els = document.querySelectorAll('.sas-protege');
      for (var i = 0; i < els.length; i++) els[i].hidden = true;
    }
    function revelerContenuProtege() {
      var els = document.querySelectorAll('.sas-protege');
      for (var i = 0; i < els.length; i++) els[i].hidden = false;
    }

    /* ---------- Vérification du code / du contenu du QR ----------
       Le QR peut porter le code pur, la forme séparée par des tirets,
       ou une URL complète (…/1721310619.html…). On ne regarde que les
       chiffres : si la série attendue s'y trouve, le sas s'ouvre. */
    function payloadUnlocks(payload) {
      if (!payload) return false;
      var s = String(payload).trim();
      var chiffres = s.replace(/\D+/g, '');
      var ok = chiffres.indexOf(CODE_CHIFFRES) !== -1;
      try{ console.log('[SAS] payload=', s, 'chiffres=', chiffres, 'attendu=', CODE_CHIFFRES, 'ok=', ok); }catch(e){}
      return ok;
    }
    // Exposé pour debug console : NautilusSas._debugPayload("1721310619")
    function _debugPayload(p){ return { payload:p, chiffres:String(p).replace(/\D+/g,''), attendu:CODE_CHIFFRES, palier:n, ok: payloadUnlocks(p) }; }

    function isUnlocked() {
      try { return localStorage.getItem(UNLOCK_KEY) === 'ok'; } catch (e) { return false; }
    }
    function persistUnlock() {
      try { localStorage.setItem(UNLOCK_KEY, 'ok'); } catch (e) {}
    }

    function message(texte, kind) {
      var el = $('gateMsg');
      if (!el) return;
      el.textContent = texte || '';
      el.className = 'gate-msg' + (texte ? ' is-' + (kind || 'info') : '');
    }

    // 🔒 anti-rebond : une fois l'épreuve lancée (compte à rebours), le sas ne doit plus ramener au briefing
    function epreuveDejaLancee(){
      try{ if(window.__nautilusEpreuveDemarree) return true; }catch(e){}
      try{
        var _gu = document.getElementById('gateUnlocked');
        if(_gu && !_gu.hidden && _gu.style.display !== 'none') return true;
        var _brief = document.getElementById('briefCard');
        // si ni gateHero ni briefCard visibles, on est déjà en épreuve (cas palier 3 où brief masqué après lancement)
        if(_gu && !_gu.hidden) return true;
      }catch(e){}
      return false;
    }
    function showUnlocked(propager) {
      // si l'épreuve est déjà en cours, on ne rebascule JAMAIS vers le briefing (évite le rebond post-compte à rebours palier 3)
      if(epreuveDejaLancee()) { persistUnlock(); try{ revelerContenuProtege(); }catch(e){} return; }
      persistUnlock();
      stopCamera();
      // Compat HTML : les pages actuelles utilisent #gateHero (pas #gateCard)
      var hero = $('gateHero'); if (hero) { hero.hidden = true; try{ hero.style.display='none'; }catch(e){} }
      var carte = $('gateCard'); if (carte) carte.hidden = true;
      var ouvert = $('gateUnlocked'); if (ouvert) { ouvert.hidden = false; try{ ouvert.style.display=''; }catch(e){} }
      revelerContenuProtege();
      try{ window.scrollTo({ top: 0, behavior: 'smooth' }); }catch(e){}
      /* Signal unique pour TOUTES les pages de palier : la page fait
         alors entrer dans le BRIEFING DU CAPITAINE (écoute
         'nautilus:sas-ouvert') — l'épreuve ne s'arme qu'après le
         « ⚓ PRENDRE LES COMMANDES » du briefing, sur toute la mission. */
      var _fireBrief = function(){
        if(epreuveDejaLancee()) return;
        try { window.dispatchEvent(new Event('nautilus:sas-ouvert')); } catch (e) {}
        // Fallback si la page n'a pas encore branché son écouteur ou si le sas était déjà ouvert :
        // on force l'affichage du briefing directement si #briefCard existe encore cachée.
        try{
          if(epreuveDejaLancee()) return;
          var _brief = document.getElementById('briefCard');
          if(_brief && _brief.hidden){
            _brief.hidden = false; _brief.style.display = '';
            // Masquer le héros scellé si encore visible (double sécurité)
            var _h2 = document.getElementById('gateHero');
            if(_h2){ _h2.hidden = true; _h2.style.display='none'; }
            var _t = document.getElementById('teamCard'); if(_t){ _t.hidden=false; _t.style.display=''; }
            var _l = document.getElementById('logCard'); if(_l){ _l.hidden=false; _l.style.display=''; }
            try{ if(window.JournalDeBord) window.JournalDeBord.addLogEntry('✅ Sas ouvert — briefing du capitaine affiché (fallback).','success'); }catch(e){}
          }
        }catch(e){}
      };
      _fireBrief();
      // Re-tente à 600ms si la page branchait son écouteur en différé (cas init tardif) — mais jamais si épreuve déjà lancée
      try{ setTimeout(function(){ if(!epreuveDejaLancee()) _fireBrief(); }, 600); }catch(e){}
      /* DÉVERROUILLAGE PARTAGÉ AVEC L'ÉQUIPAGE : un seul matelot scanne
         le QR, tout son équipage voit le sas s'ouvrir en direct (état
         écrit dans Firestore, teams/{code}.sasUnlocks[n]).
         `propager === false` est réservé à l'ouverture déclenchée par
         l'écoute d'équipe elle-même : inutile de réécrire l'état déjà
         posé par le matelot qui a scanné. */ 
      if (propager !== false) propagerDeverrouillageEquipe();
    }

    /* Écrit le déverrouillage dans le document Firestore de l'équipage,
       pour que les autres matelots (sur leur propre appareil) basculent
       aussitôt vers le briefing sans avoir à rescanner le QR. Mode test,
       joueur anonyme ou réseau en rade : l'ouverture reste valable
       localement, rien n'est propagé. */
    function propagerDeverrouillageEquipe() {
      var B = window.NautilusBlocages;
      if (!B || !B.db || !B.identiteCourante) return;
      B.identiteCourante().then(function (ident) {
        if (!ident || ident.isTest || !ident.teamCode) return;
        B.db().then(function (x) {
          var patch = {};
          patch['sasUnlocks.' + n] = {
            openedAt: new Date().toISOString(),
            openedBy: ident.name || 'Un matelot'
          };
          patch.updatedAt = new Date().toISOString();
          return x.fs.updateDoc(x.fs.doc(x.db, 'teams', ident.teamCode), patch);
        }).catch(function () { /* connexion en rade : l'ouverture locale suffit */ });
      }).catch(function () {});
    }

    /* Écoute temps réel du document d'équipage : dès qu'un coéquipier
       ouvre le sas (scan réussi ailleurs), le sas s'ouvre ici aussi,
       instantanément, sans aucun geste — la page entre dans le briefing
       du capitaine exactement comme après un scan local. Couvre aussi le
       cas où l'équipage a déjà ouvert le sas pendant que cet appareil
       était ailleurs (localStorage encore vide). */
    function observerDeverrouillageEquipe() {
      var B = window.NautilusBlocages;
      if (!B || !B.identiteCourante || !B.db) {
        // B pas encore chargé (ordre des scripts) → on réessaie 400 ms plus tard (cas briefing palier 3 qui restait vide)
        try{ setTimeout(observerDeverrouillageEquipe, 400); }catch(e){}
        return;
      }
      B.identiteCourante().then(function (ident) {
        // Fallback si ident non résolu mais localStorage contient déjà l'équipe (cas reprise sans ?m= mais avec team mémorisé)
        if (!ident || !ident.teamCode) {
          try{
            var fallbackTeam = (localStorage.getItem('nautilusCurrentTeam')||'').trim().toUpperCase();
            if(fallbackTeam){
              ident = { teamCode: fallbackTeam, isTest:false, code: (localStorage.getItem('nautilusMatelotCode')||'').trim().toUpperCase() };
            } else {
              // dernier recours : code matelot en URL/localStorage → lookup direct matelots/{code}
              var fallbackCode = codeMatelot || (localStorage.getItem('nautilusMatelotCode')||'').trim().toUpperCase();
              if(fallbackCode && fallbackCode !== 'ZZZZ-0000'){
                // on tente une résolution directe sans passer par identiteCourante (évite boucle)
                B.db().then(function(x){
                  return x.fs.getDoc(x.fs.doc(x.db, 'matelots', fallbackCode));
                }).then(function(snap){
                  if(snap && snap.exists()){
                    var f = snap.data()||{};
                    var tc = (f.teamCode||'').trim().toUpperCase();
                    if(tc){
                      try{ localStorage.setItem('nautilusCurrentTeam', tc); }catch(e){}
                      if($('topTeam')) $('topTeam').textContent = NOMS_EQUIPAGES[tc] || tc;
                      // relance l'observation avec la bonne équipe
                      setTimeout(observerDeverrouillageEquipe, 200);
                    }
                  }
                }).catch(function(){});
              }
            }
          }catch(e){}
        }
        if (!ident || ident.isTest || !ident.teamCode) {
          // ident pas encore résolu (localStorage → Firestore) → retry court
          try{ setTimeout(observerDeverrouillageEquipe, 600); }catch(e){}
          return;
        }
        B.db().then(function (x) {
          var termine = false;
          var unsub = null;
          // vérification immédiate du niveau d'équipe (briefing doit apparaître avec dernier niveau même sans QR déjà scanné)
          x.fs.getDoc(x.fs.doc(x.db, 'teams', ident.teamCode)).then(function(snap){
            try{
              if(snap && snap.exists()){
                var d0 = snap.data()||{};
                if(teamHasPassedPalier(d0, n)){
                  // déjà passé ce palier → briefing direct
                  showUnlocked(false);
                  return;
                }
                // si onSnapshot tarde, on peut déjà ouvrir si sasUnlocks présent
                var o0 = d0.sasUnlocks||{};
                if(o0[n] || o0[String(n)]){ showUnlocked(false); return; }
              }
            }catch(e){}
          }).catch(function(){});
          unsub = x.fs.onSnapshot(
            x.fs.doc(x.db, 'teams', ident.teamCode),
            function (snap) {
              if (termine || !snap || !snap.exists()) return;
              if(epreuveDejaLancee()) return;
              var data = snap.data() || {};
              var ouverts = data.sasUnlocks || {};
              if (ouverts[n] || ouverts[String(n)] || teamHasPassedPalier(data, n)) {
                termine = true;
                try { if (unsub) unsub(); } catch (e) {}
                showUnlocked(false);
              }
            },
            function () { /* lecture indisponible : la vue scellée reste affichée */ }
          );
        }).catch(function () {});
      }).catch(function () {});
    }

    function refuser(payload) {
      message('❌ Ce QR Code n’ouvre pas le sas du Palier 2', 'danger');
      // Aide manuelle : si le scan échoue répétitivement, proposer la saisie du code (secours)
      try{
        var el = $('gateMsg');
        if(el && !document.getElementById('sasManualBtn')){
          var btn = document.createElement('button');
          btn.id='sasManualBtn';
          btn.type='button';
          btn.textContent='⌨️ Saisir le code manuellement';
          btn.style.cssText='margin-top:8px;padding:6px 10px;border-radius:8px;border:1px solid #6ea8ff;background:#e8f2ff;color:#0a2a44;font-weight:700;cursor:pointer;font-size:13px;';
          btn.onclick = function(){
            var v = prompt('Entre le code du sas pour '+LABEL+' (chiffres visibles sur le QR) :','');
            if(v!=null) verifier(v,'saisie manuelle');
          };
          el.appendChild(document.createElement('br'));
          el.appendChild(btn);
        }
      }catch(e){}
    }

    function verifier(payload, source) {
      var origine = source || 'QR Code';
      var _att = CODE_CHIFFRES;
      var _ch = String(payload||'').replace(/\D+/g,'');
      try{ console.log('[SAS verifier] palier='+n+' attendu='+_att+' reçu chiffres='+_ch+' raw='+String(payload).slice(0,120)); }catch(e){}
      if (payloadUnlocks(payload)) {
        message('✅ Code reconnu ('+_att+') : ouverture du sas…', 'success');
        try{ journal('✅ <b>Code reconnu</b> (' + origine + ' : <code>'+String(payload).slice(0,40)+'</code>) : le sas du ' + LABEL + ' s’ouvre.', 'success'); }catch(e){ journal('✅ Code reconnu ('+origine+') : le sas du '+LABEL+' s’ouvre.','success'); }
        setTimeout(showUnlocked, 450);
      } else {
        refuser(payload);
        try{ journal('❌ Code refusé (' + origine + ' : <code>'+String(payload).slice(0,40)+'</code> → '+_ch+') — le sas du ' + LABEL + ' reste scellé (attendu '+_att+').', 'danger'); }catch(e){ journal('❌ Code refusé (' + origine + ') — le sas du ' + LABEL + ' reste scellé.', 'danger'); }
      }
    }

    /* ---------- Caméra + jsQR ---------- */
    var stream = null;
    var scanning = false;

    function lecteurQrPret() {
      return typeof window.jsQR === 'function';
    }

    function majBoutonCamera(actif) {
      var btn = $('gateCamBtn');
      if (btn) btn.textContent = actif ? '⏹ ARRÊTER LA CAMÉRA' : '📸 ACTIVER LA CAMÉRA';
    }

    function startCamera() {
      message('');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        message('📷 Caméra indisponible sur cet appareil : importe la PHOTO du QR Code.', 'warning');
        journal('📷 Caméra indisponible sur cet appareil.', 'warning');
        return;
      }
      if (!lecteurQrPret()) {
        message('📷 Le lecteur QR n’a pas pu se charger (connexion ?). Importe la PHOTO du QR Code.', 'warning');
        journal('📷 Lecteur QR indisponible (connexion ?).', 'warning');
        return;
      }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then(function (s) {
          stream = s;
          var video = $('gateCam');
          video.srcObject = s;
          video.hidden = false;
          $('gateCamPlaceholder').hidden = true;
          $('gateScanStatus').textContent = 'Vise le QR Code…';
          video.play().catch(function () {});
          scanning = true;
          majBoutonCamera(true);
          journal('📷 Caméra activée — scan du QR Code en cours…', 'info');
          tick();
        })
        .catch(function () {
          message('📷 Caméra refusée. Autorise l’accès, ou importe la PHOTO du QR Code.', 'warning');
          journal('📷 Accès caméra refusé.', 'warning');
        });
    }

    function stopCamera() {
      scanning = false;
      if (stream) {
        stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
        stream = null;
      }
      var video = $('gateCam');
      if (video) { try { video.pause(); } catch (e) {} video.srcObject = null; video.hidden = true; }
      var ph = $('gateCamPlaceholder');
      if (ph) ph.hidden = false;
      var st = $('gateScanStatus');
      if (st) st.textContent = '';
      majBoutonCamera(false);
    }

    function tick() {
      if (!scanning) return;
      var video = $('gateCam');
      var canvas = $('gateCanvas');
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        var w = video.videoWidth, h = video.videoHeight;
        if (w > 0 && h > 0) {
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;
          var ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(video, 0, 0, w, h);
          try {
            var img = ctx.getImageData(0, 0, w, h);
            var trouve = window.jsQR && window.jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' });
            if (trouve && trouve.data) { verifier(trouve.data, 'scan caméra'); return; }
          } catch (e) { /* image illisible : on continue de viser */ }
        }
      }
      requestAnimationFrame(tick);
    }

    /* ---------- IMPORT PHOTO du QR CODE ---------- */
    function importerPhoto(fichier) {
      message('');
      if (!fichier) return;
      if (!lecteurQrPret()) {
        message('🖼️ Le lecteur QR n’a pas pu se charger (connexion ?). Zoome bien sur la photo et réessaie.', 'warning');
        journal('🖼️ Lecteur QR indisponible : la photo n’a pas pu être lue.', 'warning');
        return;
      }
      journal('🖼️ Photo du QR Code importée — lecture en cours…', 'info');
      var lecteur = new FileReader();
      lecteur.onload = function () {
        var img = new Image();
        img.onload = function () {
          /* On borne la taille : au-delà, le décodage rame sur mobile. */
          var MAX = 1400;
          var ratio = Math.min(1, MAX / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * ratio));
          var h = Math.max(1, Math.round(img.height * ratio));
          var canvas = $('gateCanvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, w, h);
          try {
            var data = ctx.getImageData(0, 0, w, h);
            var trouve = window.jsQR(data.data, w, h, { inversionAttempts: 'attemptBoth' });
            if (trouve && trouve.data) {
              verifier(trouve.data, 'photo importée');
            } else {
              message('🖼️ Aucun QR Code lisible sur cette photo. Recadre-la sur le code et réessaie.', 'warning');
              journal('🖼️ Aucun QR Code lisible sur la photo importée.', 'warning');
            }
          } catch (e) {
            message('🖼️ Photo illisible. Réessaie avec un cliché plus net.', 'warning');
            journal('🖼️ Photo illisible : le décodage a échoué.', 'warning');
          }
        };
        img.onerror = function () {
          message('🖼️ Ce fichier n’est pas une image lisible. Choisis la photo du QR Code.', 'danger');
          journal('🖼️ Fichier refusé : ce n’est pas une image.', 'danger');
        };
        img.src = String(lecteur.result || '');
      };
      lecteur.onerror = function () {
        message('🖼️ Photo illisible. Réessaie avec un cliché plus net.', 'warning');
      };
      lecteur.readAsDataURL(fichier);
    }

    /* ---------- Câblage ---------- */
    var backBtn = $('backBtn');
    if (backBtn) backBtn.addEventListener('click', function () { location.href = 'index.html'; });
    var camBtn = $('gateCamBtn');
    if (camBtn) camBtn.addEventListener('click', function () {
      if (scanning) { stopCamera(); journal('⏹ Caméra arrêtée.', 'info'); }
      else startCamera();
    });
    var importBtn = $('gateImportBtn');
    if (importBtn) importBtn.addEventListener('click', function () { $('gateFile').click(); });
    var fileInput = $('gateFile');
    if (fileInput) fileInput.addEventListener('change', function (e) {
      importerPhoto(e.target.files && e.target.files[0]);
      e.target.value = '';   // même photo deux fois de suite = même combat, on réarme
    });
    /* La SAISIE MANUSCRITE du numéro secret (gateCodeBtn/gateCodeInput)
       a été SUPPRIMÉE de la page : seules la caméra et la photo du QR
       Code lèvent désormais le scellé. */
    document.addEventListener('visibilitychange', function () { if (document.hidden) stopCamera(); });
    window.addEventListener('beforeunload', stopCamera);

    /* Équipage affiché en barre du haut — celui DU MATELOT CONNECTÉ,
       jamais une simple mémoire d'appareil.

       BUG CORRIGÉ (signalé sur le briefing du capitaine) : un matelot
       connecté avec SON code voyait « 🧪 Mode test — aucun équipage ».
       Cause : depuis l'accueil, la session est VOLONTAIREMENT volatile
       et le Code Matelot voyage dans l'URL (?m=ABCD-1234) — « le seul
       vecteur fiable » (commentaire du cockpit). Ce module, lui, ne
       lisait QUE localStorage : un appareil où traînait encore le code
       de test ZZZZ-0000 (laissé par un ancien lien concepteur
       palier1.html?code=NEMO&m=ZZZZ-0000, que rien n'effaçait plus
       depuis la suppression du bouton « quitter le mode test ») plaquait
       « Mode test » sur un vrai matelot. Lecture réalignée sur TOUT le
       site (matelot-blocages.js, palier1.html) : ?m= d'abord — et on le
       mémorise —, localStorage ensuite. Règle : « Mode test » n'existe
       QUE pour le code ZZZZ-0000 ; sinon, l'équipage est celui du
       matelot connecté. */
    var codeMatelot = '';
    try {
      var pm = location.search.match(/[?&]m=([^&]+)/);
      if (pm && pm[1]) {
        codeMatelot = decodeURIComponent(pm[1].replace(/\+/g, ' ')).trim().toUpperCase();
        if (codeMatelot) { try { localStorage.setItem('nautilusMatelotCode', codeMatelot); } catch (e) {} }
      }
    } catch (e) {}
    if (!codeMatelot) {
      try { codeMatelot = (localStorage.getItem('nautilusMatelotCode') || '').trim().toUpperCase(); } catch (e) {}
    }
    var equipage = null;
    var modeTest = (codeMatelot === 'ZZZZ-0000');
    try {
      if (!modeTest) {
        var code = localStorage.getItem('nautilusCurrentTeam');
        if (code) equipage = NOMS_EQUIPAGES[code] || code;
        if (equipage && $('topTeam')) $('topTeam').textContent = equipage;
      } else if ($('topTeam')) {
        $('topTeam').textContent = '🧪 Mode test — aucun équipage';
      }
    } catch (e) {}
    /* Affinage réseau : la FICHE du matelot fait foi pour l'équipage
       (identiteCourante corrige d'ailleurs nautilusCurrentTeam au
       passage si l'appareil traînait un autre équipage). Différé d'un
       tour d'événements : matelot-blocages.js est alors chargé quel que
       soit l'ordre des scripts de la page. Hors connexion, la lecture
       échoue doucement et la mémoire ci-dessus reste affichée —
       fail-open : on n'efface JAMAIS l'équipage sur un doute réseau. */
    if (!modeTest) {
      setTimeout(function () {
        try {
          var B = window.NautilusBlocages;
          if (!B || !B.identiteCourante || !$('topTeam')) return;
          B.identiteCourante().then(function (ident) {
            if (!ident || ident.isTest || !ident.teamCode || !$('topTeam')) return;
            $('topTeam').textContent = NOMS_EQUIPAGES[ident.teamCode] || ident.teamCode;
          }).catch(function () {});
        } catch (e) {}
      }, 0);
    }
    /* Journal de bord : première ligne du suivi en direct — l'équipage
       vient de franchir la porte de la ZONE SCELLÉE. */
    journal('🛡️ Portail du <b>' + LABEL + '</b> atteint'
      + (modeTest ? ' en <b>mode test</b> (hors équipage)' : (equipage ? ' par l’équipage <b>' + equipage + '</b>' : ''))
      + ' : en attente du QR Code de la zone de recherche.', 'info');

    /* Retour sur la page avec le sas déjà ouvert : le contenu protégé
       est montré aussitôt — le script de la page fait alors entrer
       dans le BRIEFING DU CAPITAINE (héros et sas rangés), et le
       mini-jeu n'apparaît qu'après « ⚓ PRENDRE LES COMMANDES ». */
    // Helpers locaux pour gérer les 2 IDs historiques (gateCard = ancien, gateHero = actuel)
    function _showScelle(){
      var _hero = $('gateHero'); if(_hero){ _hero.hidden=false; try{_hero.style.display='';}catch(e){} }
      var _gc = $('gateCard'); if(_gc) _gc.hidden=false;
      var _ou = $('gateUnlocked'); if(_ou){ _ou.hidden=true; try{_ou.style.display='none';}catch(e){} }
      cacherContenuProtege();
    }
    function _showDejaOuvert(){
      var _hero = $('gateHero'); if(_hero){ _hero.hidden=true; try{_hero.style.display='none';}catch(e){} }
      var _gc = $('gateCard'); if(_gc) _gc.hidden=true;
      var _ou = $('gateUnlocked'); if(_ou){ _ou.hidden=false; try{_ou.style.display='';}catch(e){} }
      revelerContenuProtege();
    }
    if (sasForceFerme()) {
      /* Concepteur : le portail se montre SCELLÉ même si le sas est déjà
         ouvert sur cet appareil — tout est en place pour viser le vrai
         QR Code (le scan lève alors le scellé normalement). */
      _showScelle();
      journal('🧪 Mode concepteur : page scellée affichée pour tester le QR Code (le déverrouillage mémorisé est ignoré sur cette vue).', 'info');
    } else if (scanDemande()) {
      /* Matelot qui vient scanner le QR du palier suivant : le portail
         se montre SCELLÉ même si le sas est déjà ouvert sur cet appareil
         (cas du concepteur, ou d'un retour après coup) — le scan reste le
         geste attendu. */
      _showScelle();
      journal('📷 ' + LABEL + ' : sas prêt à scanner le QR Code.', 'info');
    } else if (isUnlocked()) {
      _showDejaOuvert();
      journal('🔓 Sas déjà ouvert sur cet appareil : le briefing du capitaine s’affiche directement.', 'success');
    } else {
      // ⏳ anti-flash : on ne plaque pas immédiatement la page scellée ; on affiche une vérification courte
      // et on laisse 700 ms à l'écoute d'équipe (Firestore) pour éventuellement ouvrir le sas sans flash
      (function(){
        var _hero = $('gateHero');
        var _alreadyHandled = false;
        function _afficherVerif(){
          if(_alreadyHandled) return;
          if(isUnlocked()){ _alreadyHandled=true; _showDejaOuvert(); return; }
          if(_hero){
            try{
              var _lock = _hero.querySelector('.sas-lock-ico');
              if(_lock) _lock.textContent = '🔎';
              var _t = _hero.querySelector('.sas-titre');
              if(_t) _t.textContent = 'Vérification du sas…';
              var _m = _hero.querySelector('.sas-msg');
              if(_m) _m.innerHTML = 'On vérifie si ton équipage a déjà ouvert ce sas…';
              var _box = document.getElementById('gateScanbox');
              if(_box) _box.style.opacity = '.35';
            }catch(e){}
          }
        }
        _afficherVerif();
        // si après 900 ms toujours scellé, on restaure la vraie scène scellée
        setTimeout(function(){
          if(_alreadyHandled) return;
          if(epreuveDejaLancee()) return;
          if(isUnlocked()){ _showDejaOuvert(); return; }
          // vérifie si observer a déjà ouvert (gateHero déjà masqué)
          var _h = $('gateHero');
          if(_h && _h.hidden) return;
          // restaure le vrai contenu scellé
          try{
            var _lock2 = _hero && _hero.querySelector('.sas-lock-ico');
            if(_lock2) _lock2.textContent = '🔒';
            var _t2 = _hero && _hero.querySelector('.sas-titre');
            if(_t2) _t2.textContent = '⛔ Ce palier est verrouillé.';
            var _m2 = _hero && _hero.querySelector('.sas-msg');
            if(_m2) _m2.innerHTML = 'Déverrouillez le palier suivant grâce au <b>QR Code de la zone de recherche</b>.';
            var _box2 = document.getElementById('gateScanbox');
            if(_box2) _box2.style.opacity = '';
          }catch(e){}
          _showScelle();
          journal('🔒 ' + LABEL + ' — zone scellée : QR Code requis.', 'info');
        }, 900);
        cacherContenuProtege();
      })();
    }

    /* Expose l'écoute d'équipe : la page l'appelle quand elle affiche la
       VUE SCELLÉE, pour basculer en direct dès qu'un coéquipier ouvre le
       sas (déverrouillage partagé, plus seulement local à l'appareil). */
    window.NautilusSas.observerDeverrouillageEquipe = observerDeverrouillageEquipe;
  }

  /* ---------- « PAGE SCELLÉE » POUR TESTER LES QR CODES (concepteur) ------
     ?sas=ferme force l'affichage du portail scellé même si ce sas est
     déjà ouvert sur cet appareil : le concepteur vise un VRAI QR
     imprimé et vérifie que le scan fonctionne, comme chez un joueur. */
  function sasForceFerme() {
    try { return /[?&]sas=ferme(?:&|$)/.test(location.search); } catch (e) { return false; }
  }

  /* ---------- INTENTION « SCANNER LE QR » (bouton de l'écran de victoire) --
     ?scan=1 force AUSSI l'affichage du portail scellé (scanner), même si
     le sas est déjà ouvert sur cet appareil. Contrairement à ?sas=ferme
     (réservé au concepteur, journal « Mode concepteur »), c'est le geste
     normal du matelot : après une victoire, il rallie la zone et vient
     viser le QR Code du palier suivant. */
  function scanDemande() {
    try { return /[?&]scan=1(?:&|$)/.test(location.search); } catch (e) { return false; }
  }

  /* Consultation externe : le sas de ce palier est-il déjà ouvert ici ? */
  function estDeverrouille(palier) {
    var n = Math.max(2, palier | 0);
    var code = BASE.map(function (x) { return String(x + (n - 1)); }).join('');
    try { return localStorage.getItem('nautilusUnlock:palier:' + code) === 'ok'; } catch (e) { return false; }
  }

  // Outil de secours console : NautilusSas.forceUnlock(2) ouvre le palier 2 sans QR (debug)
  // NOTE: défini hors de init() pour éviter ReferenceError (n/showUnlocked sont locaux à init)
  function forceUnlockGlobal(palier){
    var n2 = Math.max(2, palier|0);
    var code2 = BASE.map(function(x){ return String(x+(n2-1)); }).join('');
    try{ localStorage.setItem('nautilusUnlock:palier:'+code2,'ok'); }catch(e){}
    try{ console.log('[SAS] forceUnlock palier '+n2+' code '+code2); }catch(e){}
    try{ window.location.reload(); }catch(e){}
  }
  window.NautilusSas.teamHasPassedPalier = teamHasPassedPalier;
  window.NautilusSas.STEPS_ORDER = STEPS_ORDER;
  window.NautilusSas.palierStepId = palierStepId;
  window.NautilusSas = { init: init, estDeverrouille: estDeverrouille, sasForceFerme: sasForceFerme, scanDemande: scanDemande, forceUnlock: forceUnlockGlobal, _codeAttendu: function(p){ var _n=Math.max(2,p|0); return BASE.map(function(x){return String(x+(_n-1));}).join(''); }, teamHasPassedPalier: teamHasPassedPalier, STEPS_ORDER: STEPS_ORDER, palierStepId: palierStepId };
})();
