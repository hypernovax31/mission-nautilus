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
      var chiffres = String(payload).replace(/\D+/g, '');
      return chiffres.indexOf(CODE_CHIFFRES) !== -1;
    }

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

    function showUnlocked(propager) {
      persistUnlock();
      stopCamera();
      var carte = $('gateCard'); if (carte) carte.hidden = true;
      var ouvert = $('gateUnlocked'); if (ouvert) ouvert.hidden = false;
      revelerContenuProtege();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      /* Signal unique pour TOUTES les pages de palier : la page fait
         alors entrer dans le BRIEFING DU CAPITAINE (écoute
         'nautilus:sas-ouvert') — l'épreuve ne s'arme qu'après le
         « ⚓ PRENDRE LES COMMANDES » du briefing, sur toute la mission. */
      try { window.dispatchEvent(new Event('nautilus:sas-ouvert')); } catch (e) {}
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
      if (!B || !B.identiteCourante || !B.db) return;
      B.identiteCourante().then(function (ident) {
        if (!ident || ident.isTest || !ident.teamCode) return;
        B.db().then(function (x) {
          var termine = false;
          var unsub = null;
          unsub = x.fs.onSnapshot(
            x.fs.doc(x.db, 'teams', ident.teamCode),
            function (snap) {
              if (termine || !snap || !snap.exists()) return;
              var data = snap.data() || {};
              var ouverts = data.sasUnlocks || {};
              if (ouverts[n]) {
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

    function refuser() {
      message('❌ Ce QR Code n’ouvre pas le sas du ' + LABEL + '. Recherche le bon !', 'danger');
    }

    function verifier(payload, source) {
      var origine = source || 'QR Code';
      if (payloadUnlocks(payload)) {
        message('✅ Code reconnu : ouverture du sas…', 'success');
        journal('✅ <b>Code reconnu</b> (' + origine + ') : le sas du ' + LABEL + ' s’ouvre.', 'success');
        setTimeout(showUnlocked, 450);
      } else {
        refuser();
        journal('❌ Code refusé (' + origine + ') — le sas du ' + LABEL + ' reste scellé.', 'danger');
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
    if (sasForceFerme()) {
      /* Concepteur : le portail se montre SCELLÉ même si le sas est déjà
         ouvert sur cet appareil — tout est en place pour viser le vrai
         QR Code (le scan lève alors le scellé normalement). */
      var carteF = $('gateCard'); if (carteF) carteF.hidden = false;
      var ouvertF = $('gateUnlocked'); if (ouvertF) ouvertF.hidden = true;
      cacherContenuProtege();
      journal('🧪 Mode concepteur : page scellée affichée pour tester le QR Code (le déverrouillage mémorisé est ignoré sur cette vue).', 'info');
    } else if (scanDemande()) {
      /* Matelot qui vient scanner le QR du palier suivant : le portail
         se montre SCELLÉ même si le sas est déjà ouvert sur cet appareil
         (cas du concepteur, ou d'un retour après coup) — le scan reste le
         geste attendu. */
      var carteS = $('gateCard'); if (carteS) carteS.hidden = false;
      var ouvertS = $('gateUnlocked'); if (ouvertS) ouvertS.hidden = true;
      cacherContenuProtege();
      journal('📷 ' + LABEL + ' : sas prêt à scanner le QR Code.', 'info');
    } else if (isUnlocked()) {
      var carte = $('gateCard'); if (carte) carte.hidden = true;
      var ouvert = $('gateUnlocked'); if (ouvert) ouvert.hidden = false;
      revelerContenuProtege();
      journal('🔓 Sas déjà ouvert sur cet appareil : le briefing du capitaine s’affiche directement.', 'success');
    } else {
      cacherContenuProtege();
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

  window.NautilusSas = { init: init, estDeverrouille: estDeverrouille, sasForceFerme: sasForceFerme, scanDemande: scanDemande };
})();
