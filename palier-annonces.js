/* =============================================================
   NAUTILUS — ANNONCES « UN ÉQUIPAGE A FRANCHI UN PALIER »
   -------------------------------------------------------------
   Script commun aux pages du jeu. Deux services :

   1. ANNONCE VERTE EN COIN DE FENÊTRE
      Quand un équipage franchit un palier, TOUS les équipages en
      ligne sont prévenus par un petit message vert, à halo
      clignotant, affiché UNE SEULE FOIS dans un coin de la fenêtre
      (aussi « à la reprise d'un mini-jeu » : l'événement est
      révélé au prochain passage s'il a été manqué).
      Un court message d'encouragement est ajouté pour les
      équipages qui n'ont pas encore franchi ce palier.

   2. SON DE VICTOIRE (assets/Victoire.mp3)
      Joué avec l'annonce, et sur l'écran « Épreuve validée ! ».

   RÈGLES AUDIO (les mêmes que partout dans le jeu) :
     - interrupteur général « sonar » respecté (nautilusSoundOn) ;
     - aucun son ne part si AUCUN geste n'a eu lieu sur la page
       (impossible sur iPhone, inutile d'insister) ;
     - aucun son si la fenêtre n'est pas visible ;
     - JAMAIS d'amorçage « play() muet » : on télécharge et décode
       le fichier en silence au premier geste, puis la lecture
       passe par Web Audio (recette éprouvée de l'alarme de fin).
   ============================================================= */
(function () {
  'use strict';

  if (typeof window === 'undefined' || window.NautilusAnnonces) return;

  /* ---------- Mémoire des annonces déjà vues (par appareil) ---------- */
  const SEEN_KEY = 'nautilusPalierAnnoncesVus';
  let _seenCache = null;

  function _loadSeen() {
    if (_seenCache) return _seenCache;
    let obj = {};
    try {
      const brut = localStorage.getItem(SEEN_KEY);
      const parsed = brut ? JSON.parse(brut) : {};
      if (parsed && typeof parsed === 'object') obj = parsed;
    } catch (e) { /* mémoire illisible : on repart d'une page blanche */ }
    _seenCache = obj;
    return _seenCache;
  }
  function _saveSeen() {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(_seenCache || {})); }
    catch (e) { /* mémoire pleine : l'annonce pourrait revenir, sans gravité */ }
  }

  /* ---------- Sélection PURE des événements à annoncer ----------
     Fonction sans aucun effet de bord (tests la recouvrent) :
     sépare les équipages dont `lastStepCompletedAt` est plus récent
     que la dernière fois où CET appareil les a vues.
     Règle « une seule fois » + pas de rafale d'annonces périmées au
     tout premier contact : une équipe jamais vue pose sa date de base
     en silence, les annonces ne partent que d'événements NOUVEAUX. */
  function collectUnseenEvents(teams, seen) {
    const events = [];
    const nextSeen = { ...(seen || {}) };
    let changed = false;
    (teams || []).forEach((t) => {
      if (!t || !t.teamCode || !t.lastStepCompleted) return;
      const at = String(t.lastStepCompletedAt || '');
      if (!at) return;
      if (!(t.teamCode in nextSeen)) {
        /* Première rencontre avec cette équipe : on enregistre sa date
           comme point de départ, SANS annoncer (elle peut dater
           d'avant l'arrivée du joueur). */
        nextSeen[t.teamCode] = at;
        changed = true;
        return;
      }
      if (new Date(at).getTime() > new Date(nextSeen[t.teamCode]).getTime()) {
        nextSeen[t.teamCode] = at;
        changed = true;
        events.push(t);
      }
    });
    return { events, nextSeen, changed };
  }

  /* ---------- Détection du premier geste (règle d'or du son) ---------- */
  let _gestureOk = false;
  const _GESTES = ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'click'];
  function _onFirstGesture() {
    _gestureOk = true;
    _primeVictorySound();
    _GESTES.forEach((t) => document.removeEventListener(t, _onFirstGesture, true));
  }
  _GESTES.forEach((t) => {
    document.addEventListener(t, _onFirstGesture, { capture: true, passive: true });
  });

  /* ---------- Victoire.mp3 : préparation SILENCIEUSE + lecture ---------- */
  let _vicCtx = null;     // contexte créé/recréé DANS le premier geste
  let _vicBuf = null;     // son décodé, prêt à jouer
  let _vicLoading = null; // décodage en cours (anti-doublon)
  let _vicFallback = null;// lecteur <audio> de repli
  let _vicPlaying = false;

  function _victoryAudioCtx() {
    if (_vicCtx && _vicCtx.state !== 'closed') return _vicCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { _vicCtx = new AC(); } catch (e) { return null; }
    if (_vicCtx.state === 'suspended') _vicCtx.resume().catch(() => {});
    return _vicCtx;
  }

  function _primeVictorySound() {
    if (_vicBuf || _vicLoading) return;
    const ctx = _victoryAudioCtx();
    if (!ctx) return; // Web Audio indisponible : le repli <audio> suffira
    _vicLoading = fetch('assets/Victoire.mp3')
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then((b) => ctx.decodeAudioData(b))
      .then((d) => { _vicBuf = d; })
      .catch(() => { _vicLoading = null; });
  }

  function _sonAutorise() {
    try { if (localStorage.getItem('nautilusSoundOn') === '0') return false; } catch (e) {}
    if (!_gestureOk) return false;                       // aucun geste sur la page : silence
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return false;
    return true;
  }

  /* Joue Victoire.mp3 si (et seulement si) les règles le permettent.
     Renvoie true si une lecture a été demandée. */
  function playVictorySound() {
    if (!_sonAutorise()) return false;
    if (_vicPlaying) return false;
    _vicPlaying = true;
    const fin = () => { _vicPlaying = false; };
    /* Web Audio d'abord : le contexte a été débloqué DANS le premier
       geste — la lecture déclenchée ensuite par un événement réseau
       reste autorisée, y compris sur iPhone. */
    const ctx = _victoryAudioCtx();
    if (ctx && _vicBuf) {
      try {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const src = ctx.createBufferSource();
        src.buffer = _vicBuf;
        const g = ctx.createGain();
        g.gain.value = 0.85;
        src.connect(g);
        g.connect(ctx.destination);
        src.onended = fin;
        src.start();
        return true;
      } catch (e) { /* on tente le repli ci-dessous */ }
    }
    /* Repli <audio> : sur PC/Mac et Android, une lecture démarrée hors
       geste passe après un premier contact avec la page. */
    try {
      const a = _vicFallback || new Audio('assets/Victoire.mp3');
      _vicFallback = a;
      a.preload = 'auto';
      a.volume = 0.9;
      try { a.currentTime = 0; } catch (e) {}
      a.onended = fin;
      a.onerror = fin;
      const p = a.play();
      if (p && p.catch) p.catch(() => fin());
      return true;
    } catch (e) { fin(); return false; }
  }

  /* ---------- Habillage (injecté une fois) ---------- */
  function _injectStyles() {
    if (document.getElementById('na-annonces-style')) return;
    const st = document.createElement('style');
    st.id = 'na-annonces-style';
    st.textContent = `
      #naAnnounceStack{
        position:fixed;left:12px;bottom:12px;z-index:10060;
        display:flex;flex-direction:column;gap:10px;
        max-width:min(390px,94vw);
      }
      .na-palier-announce{
        position:relative;
        background:linear-gradient(145deg,rgba(9,72,42,.97),rgba(6,38,24,.97));
        border:2px solid rgba(91,224,155,.85);
        border-radius:16px;color:#eafff3;
        padding:12px 40px 12px 14px;
        box-shadow:0 14px 34px rgba(0,0,0,.5);
        font-family:Arial,Helvetica,sans-serif;
        animation:naAnnounceIn .35s ease both,
                  naAnnounceHalo 1.7s ease-in-out .4s infinite;
      }
      .na-palier-announce.leaving{
        animation:naAnnounceOut .3s ease forwards;
      }
      .na-announce-title{
        display:flex;align-items:center;gap:8px;
        font-size:12px;font-weight:900;letter-spacing:.09em;
        text-transform:uppercase;color:#8ff0b8;margin:0 0 6px;
      }
      .na-announce-body{font-size:13.5px;line-height:1.5;font-weight:700;}
      .na-announce-body b{color:#fff;}
      .na-announce-cheer{
        margin-top:6px;font-size:12.5px;line-height:1.45;
        color:#c9f5da;font-weight:700;
      }
      .na-announce-close{
        position:absolute;top:6px;right:8px;
        background:transparent;border:0;color:#8ff0b8;
        font-size:16px;font-weight:900;cursor:pointer;
        padding:2px 6px;line-height:1;border-radius:8px;
      }
      .na-announce-close:hover{color:#fff;background:rgba(91,224,155,.18);}
      @keyframes naAnnounceIn{
        from{opacity:0;transform:translateY(14px) scale(.96);}
        to{opacity:1;transform:none;}
      }
      @keyframes naAnnounceOut{
        to{opacity:0;transform:translateY(10px) scale(.97);}
      }
      /* Halo vert clignotant demandé : le contour pulse doucement. */
      @keyframes naAnnounceHalo{
        0%,100%{box-shadow:0 14px 34px rgba(0,0,0,.5),0 0 0 0 rgba(91,224,155,.55),0 0 14px rgba(91,224,155,.45);}
        50%{box-shadow:0 14px 34px rgba(0,0,0,.5),0 0 0 7px rgba(91,224,155,.10),0 0 30px rgba(91,224,155,.85);}
      }
      @media (prefers-reduced-motion:reduce){
        .na-palier-announce{animation:naAnnounceIn .2s ease both;}
      }
    `;
    document.head.appendChild(st);
  }

  function _stack() {
    let s = document.getElementById('naAnnounceStack');
    if (!s) {
      s = document.createElement('div');
      s.id = 'naAnnounceStack';
      s.setAttribute('aria-live', 'polite');
      document.body.appendChild(s);
    }
    return s;
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Affichage de l'annonce verte ----------
     payload : { teamName, palierLabel, encouragement }
     Apparaît une fois, coin bas-gauche, halo clignotant, ~14 s. */
  function showPalierAnnouncement(payload) {
    if (typeof document === 'undefined' || !document.body) return;
    _injectStyles();
    const el = document.createElement('div');
    el.className = 'na-palier-announce';
    const cheer = payload.encouragement
      ? `<div class="na-announce-cheer">${esc(payload.encouragement)}</div>`
      : '';
    el.innerHTML =
      `<div class="na-announce-title"><span aria-hidden="true">🏆</span> Palier franchi !</div>` +
      `<div class="na-announce-body">L'équipage <b>« ${esc(payload.teamName || '—')} »</b> vient de franchir le sas du <b>${esc(payload.palierLabel || 'palier')}</b>.</div>` +
      cheer +
      `<button type="button" class="na-announce-close" aria-label="Fermer l'annonce">×</button>`;
    const close = () => {
      if (el.classList.contains('leaving')) return;
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 320);
    };
    el.querySelector('.na-announce-close').addEventListener('click', close);
    _stack().appendChild(el);
    setTimeout(close, 14000);
  }

  /* Message d'encouragement pour les équipages en retard — court. */
  const ENCOURAGEMENTS = [
    '💪 À vous de jouer : votre équipage franchira le sien !',
    '💪 Courage, plongez : la suite de la mission vous attend !',
    '💪 Tout l’océan croit en vous — à votre tour maintenant !'
  ];
  function encouragementPour(index) {
    return ENCOURAGEMENTS[Math.abs(index || 0) % ENCOURAGEMENTS.length];
  }

  /* ---------- Point d'entrée : instantané Firestore des équipages ----------
     opts :
       myTeamCode       : code de MON équipage (si identifié)
       myCompletedSteps : paliers déjà franchis par mon équipage
       skipOwn          : true pour ne pas m'annoncer ma propre victoire
                          (page palier : l'écran « Épreuve validée ! » la
                          montre déjà)
       resolveName(t)   : nom d'affichage de l'équipage
       withSound        : jouer Victoire.mp3 avec l'annonce (défaut true) */
  function handleTeamsSnapshot(teams, opts) {
    opts = opts || {};
    const seen = _loadSeen();
    const { events, nextSeen, changed } = collectUnseenEvents(teams, seen);
    _seenCache = nextSeen;
    if (changed) _saveSeen();

    const aMontrer = events.filter((t) => !(opts.skipOwn && opts.myTeamCode && t.teamCode === opts.myTeamCode));
    if (!aMontrer.length) return 0;

    const resolveName = typeof opts.resolveName === 'function'
      ? opts.resolveName
      : (t) => (t.teamName || t.teamCode);

    aMontrer.forEach((t, i) => {
      /* En retard = mon équipage n'a pas encore franchi ce palier. */
      const enRetard = !opts.myTeamCode
        || (t.teamCode !== opts.myTeamCode
            && !(opts.myCompletedSteps || []).includes(t.lastStepCompleted));
      const payload = {
        teamName: resolveName(t),
        palierLabel: t.lastStepCompletedLabel || t.lastStepCompleted,
        encouragement: enRetard ? encouragementPour(i) : null
      };
      setTimeout(() => {
        showPalierAnnouncement(payload);
        if (i === 0 && opts.withSound !== false) playVictorySound();
      }, i * 900);
    });
    return aMontrer.length;
  }

  window.NautilusAnnonces = {
    collectUnseenEvents,      // pure — recouverte par les tests
    handleTeamsSnapshot,
    showPalierAnnouncement,
    playVictorySound,
    encouragementPour
  };
})();
