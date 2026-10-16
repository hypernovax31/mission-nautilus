/* =============================================================================
   ÉCOUTILLE — PAGE DE GARDE DU NAUTILUS  (ecoutille.js)

   Rôle
   ----
   Animer la page de garde décrite par css/ecoutille.css et par le bloc
   <div id="ecoutille"> placé en tête du <body> de index.html :

     1. l'ordinateur de bord « tape » son journal pendant que l'alarme
        rouge bat sur la cloison ;
     2. le visiteur appuie sur le BOUTON ROUGE « START » ;
     3. les 8 pales de l'écoutille basculent autour de leur pivot — c'est
        un vrai diaphragme d'optique, voir la note ci-dessous ;
     4. la lumière du sas submerge le trou, la caméra traverse l'écoutille,
        l'écran part en éclat blanc ;
     5. on découvre l'accueil du jeu, déjà animé derrière.

   Pourquoi une page de garde
   --------------------------
   Un navigateur n'autorise le son qu'après un VRAI geste de l'utilisateur.
   Le clic sur START est ce geste : il satisfait le guetteur de premier
   geste d'index.html (guetterPremierGeste / surPremierGeste), qui démasque
   alors l'ambiance sonore et prépare les hublots. Le site démarre donc
   avec le son, au lieu de rester muet jusqu'au premier clic de hasard.

   Le son, justement
   -----------------
   Si le joueur a coupé le sonar (localStorage['nautilusSoundOn'] === '0'),
   cette page est TOTALEMENT MUETTE : aucune lecture d'<audio>, aucun
   contexte Web Audio n'est même créé. La règle du site est absolue.

   Quand la revoit-on ?
   --------------------
   À CHAQUE chargement de l'accueil. Ce n'est pas un excès de zèle : à
   chaque chargement, le navigateur repart de zéro et refuse tout son tant
   qu'il n'a pas vu un vrai geste de l'utilisateur. L'écoutille EST ce
   geste — la sauter reviendrait à rendre le site muet.
     · ?ecoutille=0 ou /ecoutille/passer → on la passe (silence assumé) ;
     · la classe « ec-passee », posée dans le <head> avant le premier
       rendu, ne sert donc qu'à ce cas-là : pas un pixel de clignotement.

   L'IRIS (note technique)
   -----------------------
   Les 8 pales sont huit DISQUES identiques posés sur une couronne : le
   bord de chaque pale est un arc de rayon A dont le centre est à la
   distance A du centre de l'écoutille. Fermées, les huit pales se
   recouvrent et couvrent 100 % du disque (vérifié point par point) ;
   chacune bascule de 88° autour de son pivot et glisse vers l'extérieur
   assez loin pour se retirer ENTIÈREMENT derrière le bord de l'écoutille :
   l'ouverture est totale (100 %), aucun anneau de métal ne subsiste au
   bord du trou quand l'iris est ouvert. C'est exactement la construction
   d'un diaphragme photographique à 8 lamelles.

   L'ouverture est pilotée en JavaScript, image par image, en écrivant
   l'attribut transform="translate(...) rotate(a 500 0)" de chaque pale :
   les rotations SVG sont interprétées partout de la même façon, alors
   que les transforms CSS sur des enfants SVG dépendent de transform-box
   et ne sont pas fiables sur tous les moteurs. Ici : zéro surprise.
   ============================================================================= */
(function(){
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. RÉGLAGES
   * ------------------------------------------------------------------ */
  const CLE_SESSION = 'nautilusEcoutille';        // ouverte pendant cette session
  const CLE_VUE     = 'nautilusEcoutilleVue';     // vue au moins une fois
  const CLE_FORCE   = 'nautilusEcoutilleForce';   // ordre exprès : « rejoue-la »

  /* Géométrie de l'iris — valeurs VÉRIFIÉES par calcul de couverture :
     0°/0 mm   : 100,00 % du disque couvert (étanche)
     88°/295 mm :   0,00 % couvert — à l'arrêt, chaque pale est entièrement
     sortie du cercle de l'écoutille (le clip CSS découpe à rayon + 2 px,
     soit ~503 à ~511 unités du dessin selon l'écran) : l'ouverture est
     totale, plus aucun cercle de métal ne reste au bord avant l'éclat.
     (À 88°/230, il restait 6,3 % couverts : un anneau denté, opaque, qui
     bloquait la fin de l'ouverture et cassait la fluidité de l'animation.) */
  const PALE_ROTATION = 88;      // degrés de bascule de chaque pale
  const PALE_GLISSE   = 295;     // écartement vers l'extérieur (unités du dessin)
  const PALE_DUREE    = 1950;    // ms pour l'ouverture complète
  const PALE_DECALAGE = 55;      // ms de décalage d'une pale à la suivante

  /* Calendrier de l'ouverture, en millisecondes après le clic. */
  const T = {
    bascule:      170,     // les pales commencent à s'écarter
    poussee:     2150,     // la caméra traverse l'écoutille
    pousseeFin:  3300,
    eclat:       3350,     // éclat blanc
    reveler:     3480      // on découvre l'accueil
  };

  /* Tous les navigateurs du parc savent le dire ; le test est protégé pour
     qu'un moteur exotique ne fasse pas tomber la page de garde entière. */
  const PASSE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  /* Moins d'animation : tout reste, mais plus court et sans vibration. */
  const F = PASSE ? 0.35 : 1;
  const ms = v => Math.round(v * F);

  const html   = document.documentElement;
  const racine = document.getElementById('ecoutille');

  /* LE SOCLE A DÉJÀ PRIS LE RELAIS. Un mini-script écrit dans la page (voir
     « SOCLE — LE CLIC » dans index.html) a rendu le bouton rouge cliquable
     dès le chargement, au cas où ce fichier n'arriverait jamais. Il fait le
     strict nécessaire ; nous, nous faisons le cinéma. On lui retire donc la
     main — sinon un clic déclencherait l'ouverture rude ET la belle. */
  if(typeof window.__ecoutilleSecours === 'function'){
    try{ window.__ecoutilleSecours(); }catch(e){}
  }

  /* LA FEUILLE RICHE EST-ELLE LÀ ? Le socle écrit dans index.html suffit à
     afficher et ouvrir l'écoutille, mais il n'a ni masque, ni halo, ni éclat.
     La sonde est un élément de 7 px qui n'existe que dans css/ecoutille.css :
     s'il mesure 7 px, la feuille est chargée et le grand jeu peut se jouer. */
  let RICHE = false;
  try{
    const sonde = document.createElement('i');
    sonde.className = 'ec-sonde';
    document.body.appendChild(sonde);
    RICHE = getComputedStyle(sonde).width === '7px';
    sonde.remove();
  }catch(e){ RICHE = false; }
  if(racine && !RICHE){
    /* Version sans feuille dédiée : on le dit dans le DOM, au cas où. */
    racine.classList.add('ec-nu');
  }

  /* La sentinelle posée dans le <head> d'index.html surveille ce drapeau :
     s'il n'est jamais levé (fichier absent, erreur de chargement), elle
     retire la page de garde au bout de 20 s. On ne laisse JAMAIS un
     visiteur enfermé derrière l'écoutille. */
  window.__ecoutillePrete = true;

  const _minuteurs = [];
  function plusTard(fn, delai){
    const id = setTimeout(fn, delai);
    _minuteurs.push(id);
    return id;
  }
  function arreterMinuteurs(){
    while(_minuteurs.length) clearTimeout(_minuteurs.pop());
  }
  const P = delai => new Promise(res => plusTard(res, delai));

  /* ------------------------------------------------------------------ *
   * 2. STOCKAGE (tolérant : navigation privée, stockage plein…)
   * ------------------------------------------------------------------ */
  function lireSession(){
    try{ return sessionStorage.getItem(CLE_SESSION) === '1'; }
    catch(e){ return false; }
  }
  function lireVue(){
    try{ return localStorage.getItem(CLE_VUE) === '1'; }
    catch(e){ return false; }
  }
  function noter(cle){
    try{ localStorage.setItem(cle, '1'); }catch(e){ /* mode privé */ }
    try{ sessionStorage.setItem(cle, '1'); }catch(e){ /* mode privé */ }
  }

  /* ------------------------------------------------------------------ *
   * 3. LE SON
   * ------------------------------------------------------------------ */
  function silencieux(){
    try{ return localStorage.getItem('nautilusSoundOn') === '0'; }
    catch(e){ return false; }
  }

  let _ctx = null;
  let _bruit = null;
  /* Un contexte Web Audio n'est créé qu'au premier son réellement joué —
     donc jamais avant un geste, et jamais du tout si le sonar est coupé. */
  function contexte(){
    if(_ctx) return _ctx;
    if(silencieux()) return null;
    try{
      const C = window.AudioContext || window.webkitAudioContext;
      if(!C) return null;
      _ctx = new C();
    }catch(e){ _ctx = null; }
    return _ctx;
  }
  function bruitBlanc(ctx){
    if(_bruit) return _bruit;
    const n = Math.floor(ctx.sampleRate * 1.4);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    _bruit = buf;
    return buf;
  }
  function sourceBruit(ctx, t0, duree){
    const s = ctx.createBufferSource();
    s.buffer = bruitBlanc(ctx);
    s.loop = true;
    s.start(t0, Math.random() * 0.6);
    s.stop(t0 + duree + 0.05);
    return s;
  }

  /* Le verrou de coque : coup sourd + choc métallique. */
  function sonCoup(){
    const ctx = contexte(); if(!ctx) return;
    try{
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t0);
      o.frequency.exponentialRampToValueAtTime(38, t0 + .3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(.0001, t0);
      g.gain.exponentialRampToValueAtTime(.75, t0 + .012);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + .5);
      o.connect(g).connect(ctx.destination);
      o.start(t0); o.stop(t0 + .55);

      const n = sourceBruit(ctx, t0, .16);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass';
      f.frequency.value = 1350; f.Q.value = 1.1;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(.42, t0);
      ng.gain.exponentialRampToValueAtTime(.0001, t0 + .16);
      n.connect(f).connect(ng).connect(ctx.destination);
    }catch(e){ /* un navigateur sans Web Audio ne doit pas casser la page */ }
  }

  /* Déverrouillage : grondement grave + trois boulons qui cèdent. */
  function sonDeverrouillage(){
    const ctx = contexte(); if(!ctx) return;
    try{
      const t0 = ctx.currentTime;
      const n = sourceBruit(ctx, t0, 2.0);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(120, t0);
      f.frequency.linearRampToValueAtTime(420, t0 + 1.8);
      const g = ctx.createGain();
      g.gain.setValueAtTime(.0001, t0);
      g.gain.linearRampToValueAtTime(.5, t0 + .25);
      g.gain.linearRampToValueAtTime(.0001, t0 + 2.0);
      n.connect(f).connect(g).connect(ctx.destination);
      [0, .45, .95].forEach((d, i) => {
        const o = ctx.createOscillator(); o.type = 'square';
        o.frequency.value = 210 + i * 70;
        const og = ctx.createGain();
        og.gain.setValueAtTime(.0001, t0 + d);
        og.gain.exponentialRampToValueAtTime(.16, t0 + d + .01);
        og.gain.exponentialRampToValueAtTime(.0001, t0 + d + .14);
        o.connect(og).connect(ctx.destination);
        o.start(t0 + d); o.stop(t0 + d + .2);
      });
    }catch(e){}
  }

  /* Le sas se remplit de lumière : souffle d'air qui monte. */
  function sonSouffle(duree){
    const ctx = contexte(); if(!ctx) return;
    try{
      const t0 = ctx.currentTime, d = duree / 1000;
      const n = sourceBruit(ctx, t0, d + .2);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = .8;
      f.frequency.setValueAtTime(260, t0);
      f.frequency.exponentialRampToValueAtTime(2900, t0 + d);
      const g = ctx.createGain();
      g.gain.setValueAtTime(.0001, t0);
      g.gain.linearRampToValueAtTime(.3, t0 + d * .8);
      g.gain.linearRampToValueAtTime(.0001, t0 + d + .18);
      n.connect(f).connect(g).connect(ctx.destination);
    }catch(e){}
  }

  /* L'éclat : accord large et scintillement, sur la traversée. */
  function sonEclat(){
    const ctx = contexte(); if(!ctx) return;
    try{
      const t0 = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((hz, i) => {
        const o = ctx.createOscillator(); o.type = 'triangle';
        o.frequency.value = hz;
        const g = ctx.createGain();
        g.gain.setValueAtTime(.0001, t0);
        g.gain.linearRampToValueAtTime(.085 / (i * .5 + 1), t0 + .5);
        g.gain.exponentialRampToValueAtTime(.0001, t0 + 2.4);
        o.connect(g).connect(ctx.destination);
        o.start(t0); o.stop(t0 + 2.5);
      });
      const n = sourceBruit(ctx, t0, 1.1);
      const f = ctx.createBiquadFilter(); f.type = 'highpass';
      f.frequency.setValueAtTime(900, t0);
      f.frequency.exponentialRampToValueAtTime(7000, t0 + 1.0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(.0001, t0);
      g.gain.linearRampToValueAtTime(.2, t0 + .9);
      g.gain.linearRampToValueAtTime(.0001, t0 + 1.15);
      n.connect(f).connect(g).connect(ctx.destination);
    }catch(e){}
  }
  function couperLeSon(){
    if(_ctx){ try{ _ctx.close(); }catch(e){} _ctx = null; _bruit = null; }
  }

  /* L'alarme de bord : on réutilise le lecteur <audio> du site (même
     fichier, même volume que le reste du jeu) au lieu d'en créer un
     second. Fond de sortie puis remise à zéro : la page retrouve son
     lecteur intact pour ses propres alarmes. */
  let _alarmeFin = null;
  function alarmeDeBord(dureeMs){
    if(silencieux()) return;
    const a = document.getElementById('alarmAudio');
    if(!a) return;
    try{
      a.muted = false;
      a.volume = 0.6;
      a.currentTime = 0;
      const p = a.play();
      if(p && typeof p.catch === 'function') p.catch(() => {});
    }catch(e){ return; }
    let etape = 0;
    const fond = () => {
      etape++;
      try{
        if(etape < 6){ a.volume = 0.6 * (1 - etape / 6); _alarmeFin = plusTard(fond, 70); }
        else { a.volume = 0.82; a.pause(); a.currentTime = 0; }
      }catch(e){}
    };
    _alarmeFin = plusTard(fond, Math.max(600, dureeMs - 420));
  }
  function couperAlarme(){
    if(_alarmeFin) clearTimeout(_alarmeFin);
    const a = document.getElementById('alarmAudio');
    if(!a) return;
    try{ a.volume = 0.82; a.pause(); a.currentTime = 0; }catch(e){}
  }

  /* ------------------------------------------------------------------ *
   * 4. LE JOURNAL DE BORD (machine à écrire)
   * ------------------------------------------------------------------ */
  const journal = document.getElementById('ecJournal');

  function heureDeBord(){
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function lignesDuJournal(dejaVue){
    if(dejaVue){
      return [
        { t: 'ÉCOUTILLE PRINCIPALE — VERROUILLÉE' },
        { t: 'PROCÉDURE D\'EMBARQUEMENT', alerte: true, court: true },
        { t: 'APPUIE SUR START POUR OUVRIR', alerte: true }
      ];
    }
    return [
      { t: 'POSTE DE PLONGÉE — ' + heureDeBord() },
      { t: 'COQUE 28,4 BARS · ÉQUIPAGE 4/4' },
      { t: 'ÉCOUTILLE PRINCIPALE — VERROUILLÉE' },
      { t: 'ALERTE : DÉCOMPRESSION DU SAS', alerte: true },
      { t: 'APPUIE SUR START POUR OUVRIR', alerte: true }
    ];
  }

  let _annule = false;
  const attendre = delai => P(_annule ? 0 : delai);

  /* UN SEUL curseur, à la fin de la dernière ligne : c'est un terminal, pas
     une grille de curseurs. On le déplace donc à chaque nouvelle ligne au
     lieu d'en semer un par ligne. À la fin, il reste et clignote : le poste
     attend un ordre — et c'est justement le doigt sur START. */
  let _curseur = null;
  function poserCurseur(){
    if(_curseur) _curseur.remove();
    _curseur = document.createElement('span');
    _curseur.className = 'ec-curseur';
    journal.appendChild(_curseur);
  }

  async function taperJournal(dejaVue){
    if(!journal) return;
    /* Le curseur du balisage de départ : c'est lui qu'on déplacera. */
    _curseur = journal.querySelector('.ec-curseur');
    const lignes = lignesDuJournal(dejaVue);
    for(const ligne of lignes){
      if(_annule) return;
      const li = document.createElement('li');
      if(ligne.alerte) li.className = 'ec-alerte';
      journal.appendChild(li);
      poserCurseur();
      /* Trois lignes au maximum restent affichées : le panneau ne grandit pas. */
      const trop = journal.querySelectorAll('li');
      if(trop.length > 3) trop[0].remove();
      const pas = ligne.court ? 12 : 17;
      for(const c of ligne.t){
        if(_annule) return;
        li.textContent += c;
        await attendre(pas);
      }
      await attendre(ligne.alerte ? 620 : 420);
    }
  }

  /* ------------------------------------------------------------------ *
   * 5. L'IRIS : 8 pales pilotées en SVG
   * ------------------------------------------------------------------ */
  const pales = racine ? Array.from(racine.querySelectorAll('.ec-pale-bascule')) : [];

  function positionnerPales(k){
    for(let i = 0; i < pales.length; i++){
      /* Chaque pale a son propre temps de départ : la mécanique se met en
         marche lame après lame, comme un vrai diaphragme entraîné par
         une bague unique. */
      const part = Math.min(1, Math.max(0, (k - (i * PALE_DECALAGE) / PALE_DUREE) / (1 - (7 * PALE_DECALAGE) / PALE_DUREE)));
      const e = part < .5
        ? 4 * part * part * part
        : 1 - Math.pow(-2 * part + 2, 3) / 2;               /* easeInOutCubic */
      const a = (PALE_ROTATION * e).toFixed(2);
      const g = (PALE_GLISSE * e).toFixed(1);
      pales[i].setAttribute('transform', 'translate(0 ' + (-g) + ') rotate(' + a + ' 500 0)');
    }
  }

  /* Les variables CSS de l'écoutille. On garde la dernière valeur en
     mémoire : réécrire à chaque image une valeur identique ferait
     recalculer les styles pour rien. (Et surtout PAS de dataset['ec-k'] :
     un nom de jeu de données ne peut pas contenir de tiret suivi d'une
     lettre — l'affectation lève une SyntaxError dans tous les moteurs.) */
  const _vars = {};
  function poserVar(nom, valeur){
    if(_vars[nom] === valeur) return;
    _vars[nom] = valeur;
    if(!racine) return;
    try{ racine.style.setProperty('--' + nom, valeur); }
    catch(e){ /* moteur sans variables CSS : la page reste utilisable */ }
  }

  /* Petite animation image par image, robuste à un onglet mis en veille
     (le pas est borné : on ne rattrape jamais 30 s de retard d'un coup). */
  function animer(dureeMs, a, b, appliquer, fin){
    const t0 = performance.now();
    let dernier = t0;
    function image(t){
      const dt = Math.min(50, t - dernier);
      dernier = t;
      const p = Math.min(1, (t - t0) / dureeMs);
      appliquer(a + (b - a) * p, p);
      if(p < 1){ requestAnimationFrame(image); }
      else if(fin){ fin(); }
      void dt;
    }
    requestAnimationFrame(image);
  }

  /* ------------------------------------------------------------------ *
   * 6. SECOUSSE DE COQUE
   * ------------------------------------------------------------------ */
  function secouer(){
    if(PASSE) return;
    racine.classList.remove('ec-secousse');
    void racine.offsetWidth;          /* force le redémarrage de l'animation */
    racine.classList.add('ec-secousse');
    plusTard(() => racine.classList.remove('ec-secousse'), 900);
  }

  /* ------------------------------------------------------------------ *
   * 7. L'OUVERTURE
   * ------------------------------------------------------------------ */
  let _ouverte = false;

  function ouvrir(){
    if(_ouverte) return;
    _ouverte = true;
    _annule = true;                 /* le journal s'arrête net */
    arreterMinuteurs();
    plusTard(() => { _annule = false; }, 0);

    const start = document.getElementById('ecStart');
    racine.classList.add('ec-presse');
    plusTard(() => racine.classList.remove('ec-presse'), 260);

    /* Le clic est le geste qui débloque le sonar du site ; on ajoute
       par-dessus le bruit de la coque, puis l'air du sas. */
    sonCoup();
    secouer();

    plusTard(() => {
      racine.classList.add('ec-partie');
      racine.classList.remove('ec-alarme');
      couperAlarme();
      if(start) start.setAttribute('aria-disabled', 'true');
    }, ms(280));

    /* — les pales s'écartent — */
    plusTard(() => {
      sonDeverrouillage();
      animer(ms(PALE_DUREE), 0, 1, k => { positionnerPales(k); }, () => positionnerPales(1));
      /* la lumière du sas monte en même temps que les pales s'écartent */
      animer(ms(PALE_DUREE + 600), 0, .78, v => poserVar('ec-lueur', v.toFixed(3)));
    }, ms(T.bascule));

    plusTard(() => secouer(), ms(1300));

    /* — on traverse l'écoutille — */
    plusTard(() => {
      racine.classList.add('ec-poussee');
      sonSouffle(ms(1500));
      /* La caméra doit pousser le disque de lumière — l'écoutille découpée
         dans .ec-iris — entièrement HORS de l'écran avant l'éclat : sinon
         son bord dur reste visible à la fin de la traversée, un cercle
         de lumière posé sur la page, pile avant le flash blanc. La cible
         dépend de la taille de l'écran (téléphone, tablette, ordinateur) :
         on la calcule depuis le diamètre RÉEL de l'écoutille (offsetWidth
         n'est pas modifié par les transform) et la diagonale du viewport.
         2.55 suffisait sur téléphone ; sur ordinateur, le bord du disque
         restait à l'écran jusqu'à l'éclat. */
      let camFin = 2.55;
      try{
        const iris = racine.querySelector('.ec-iris');
        const hatch = iris ? iris.offsetWidth : 0;
        const larg = racine.offsetWidth || window.innerWidth || 0;
        const haut = racine.offsetHeight || window.innerHeight || 0;
        if(hatch > 0 && larg > 0 && haut > 0){
          const demiDiag = Math.hypot(larg, haut) / 2;
          camFin = Math.max(2.55, (demiDiag + 48) / (hatch / 2 + 2));
        }
      }catch(e){ /* moteur exotique : on garde la valeur par défaut */ }
      /* la trouée s'élargit ET la caméra avance : on traverse l'écoutille */
      animer(ms(T.pousseeFin - T.poussee), 1, 2.6, v => poserVar('ec-k', v.toFixed(4)));
      animer(ms(T.pousseeFin - T.poussee), 1, camFin, v => poserVar('ec-cam', v.toFixed(4)));
      animer(ms(T.pousseeFin - T.poussee), .78, .5, v => poserVar('ec-lueur', v.toFixed(3)));
    }, ms(T.poussee));

    /* — l'éclat — */
    plusTard(() => {
      const flash = racine.querySelector('.ec-flash');
      if(flash) flash.classList.add('actif');
      sonEclat();
    }, ms(T.eclat));

    plusTard(reveler, ms(T.reveler));
  }

  /* ------------------------------------------------------------------ *
   * 8. LA RÉVÉLATION : on rend l'accueil au visiteur
   * ------------------------------------------------------------------ */
  function reveler(){
    if(!racine || racine.dataset.rendu) return;
    racine.dataset.rendu = '1';

    /* Un voile blanc indépendant de la page de garde : il peut lui
       survivre, le temps que l'accueil apparaisse en fondu. */
    const voile = document.createElement('div');
    voile.className = 'ec-blanc';
    document.body.appendChild(voile);

    html.classList.remove('ec-bloque');
    html.classList.add('ec-arrivee');
    /* L'onglet reprend son vrai nom : celui de l'accueil, plus de l'écoutille. */
    try{ if(window.__ecoutilleTitre) document.title = window.__ecoutilleTitre; }catch(e){}
    noter(CLE_SESSION);
    noter(CLE_VUE);
    /* L'ordre exprès ne doit servir qu'UNE fois : sinon « Revoir
       l'écoutille » rejouerait la garde à chaque rechargement. */
    try{ sessionStorage.removeItem(CLE_FORCE); }catch(e){}

    if(!RICHE){
      /* Pas de feuille dédiée : pas d'éclat possible. On referme l'écoutille
         en fondu — c'est sobre, et surtout ça marche à tous les coups. */
      racine.style.transition = 'opacity .6s ease';
      racine.style.opacity = '0';
    }
    racine.classList.add('ec-passee');
    plusTard(() => racine.remove(), RICHE ? 0 : 620);

    requestAnimationFrame(() => {
      voile.classList.add('ec-blanc-sortie');
      plusTard(() => voile.remove(), 700);
    });
    plusTard(couperLeSon, 900);

    try{
      window.dispatchEvent(new CustomEvent('nautilus:ecoutille-ouverte'));
    }catch(e){}
  }

  /* ------------------------------------------------------------------ *
   * 9. REVOIR L'ÉCOUTILLE (bouton du pied de page de l'accueil)
   * ------------------------------------------------------------------ */
  /* L'écoutille ne s'affiche qu'à la PREMIÈRE visite de l'onglet. Ce bouton
     la ramène quand on veut : il efface le marqueur de session, pose un
     ordre exprès (au cas où l'adresse ne transporterait rien) et recharge.
     C'est aussi la sortie de secours si un jour l'adresse « ?ecoutille=1 »
     se perdait en route — proxy, lien raccourci, application installée. */
  (function binderRevoir(){
    const bouton = document.getElementById('ecRevoirBtn');
    if(!bouton) return;
    bouton.addEventListener('click', () => {
      try{
        sessionStorage.removeItem(CLE_SESSION);
        sessionStorage.setItem(CLE_FORCE, '1');
      }catch(e){ /* mode privé : on tentera quand même le rechargement */ }
      location.reload();
    });
  })();

  /* ------------------------------------------------------------------ *
   * 10. MISE EN ROUTE
   * ------------------------------------------------------------------ */
  if(!racine){ return; }        /* page sans écoutille : rien à faire */

  /* L'ORDRE VIENT DE LA SENTINELLE DU <head> : c'est elle qui a décidé
     avant le premier rendu, et elle a posé sa réponse sur window. On la
     relit ici pour ne jamais rejouer un calcul qui pourrait diverger.
     (Repli : si un jour ecoutille.js était chargé sur une page sans
     sentinelle, on refait alors la même déduction.) */
  const dejaVue = lireVue();
  let jouer;
  if(typeof window.__ecoutilleJouer === 'boolean'){
    jouer = window.__ecoutilleJouer;
  }else{
    let adresse = '';
    try{ adresse = (location.pathname + location.search + location.hash).toLowerCase(); }catch(e){}
    const forcer = /ecoutille=(1|oui)/.test(adresse) || /\/ecoutille(\/|$)/.test(adresse);
    const passer = /ecoutille=(0|non)/.test(adresse) || /ecoutille\/(passer|fermer|non)/.test(adresse);
    /* Comme la sentinelle : TOUJOURS, sauf ordre contraire. */
    jouer = !passer || forcer;
    if(!jouer){
      try{ if(sessionStorage.getItem(CLE_FORCE) === '1') jouer = true; }catch(e){}
    }
  }

  if(!jouer){
    /* La classe est déjà posée dans le <head> ; on nettoie par acquit de
       conscience (le nœud est retiré du DOM : plus rien à charger). */
    racine.classList.add('ec-passee');
    html.classList.remove('ec-bloque');
    plusTard(() => racine.remove(), 0);
    return;
  }

  /* Navigateur sans masque CSS : la cloison ne peut pas trouer son centre.
     Le repli de la feuille de style fait disparaître la coque pendant la
     traversée (classe ec-sans-masque). */
  const masqueOK = !!(window.CSS && window.CSS.supports &&
    (CSS.supports('mask-image', 'radial-gradient(#000,#fff)') ||
     CSS.supports('-webkit-mask-image', 'radial-gradient(#000,#fff)')));
  if(!masqueOK) racine.classList.add('ec-sans-masque');

  html.classList.add('ec-bloque');
  positionnerPales(0);
  poserVar('ec-k', '1');
  poserVar('ec-lueur', '0');
  poserVar('ec-cam', '1');

  const start = document.getElementById('ecStart');
  const passer = document.getElementById('ecPasser');

  /* L'alarme rouge bat dès le début : c'est elle qui donne l'urgence. */
  plusTard(() => {
    if(_ouverte) return;
    racine.classList.add('ec-alarme');
    alarmeDeBord(ms(2600));
  }, ms(650));

  /* Le journal se tape tout seul ; le bouton, lui, est actif tout de suite. */
  taperJournal(dejaVue);

  start?.addEventListener('click', ouvrir);
  start?.focus({ preventScroll: true });

  /* « Passer l'intro » : on saute directement à la fin du journal, mais il
     reste un vrai clic — c'est lui qui débloquera le son. C'est aussi la
     sortie de secours si quelqu'un ne veut pas attendre. */
  passer?.addEventListener('click', () => {
    if(_ouverte) return;
    _annule = true;
    plusTard(() => {
      _annule = false;
      if(journal){
        journal.innerHTML = '';
        const li = document.createElement('li');
        li.className = 'ec-alerte';
        li.textContent = 'APPUIE SUR START POUR OUVRIR';
        journal.appendChild(li);
        _curseur = null;
        poserCurseur();
      }
      racine.classList.add('ec-alarme');
      couperAlarme();
      alarmeDeBord(ms(1800));
    }, 30);
  });

  /* Clavier : ÉCHAP = passer l'intro, TAB = rester dans la page de garde. */
  document.addEventListener('keydown', e => {
    if(_ouverte) return;
    if(e.key === 'Escape'){ passer?.click(); return; }
    if(e.key === 'Tab'){
      const focusables = [start, passer].filter(Boolean);
      if(focusables.length < 2) return;
      const i = focusables.indexOf(document.activeElement);
      const suivant = e.shiftKey
        ? (i <= 0 ? focusables.length - 1 : i - 1)
        : (i === focusables.length - 1 ? 0 : i + 1);
      e.preventDefault();
      focusables[suivant].focus();
    }
  }, true);

  /* Un onglet quitté pendant l'intro ne doit pas laisser le journal à
     moitié tapé derrière un écran noir au retour : on reprend la main. */
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible' && !_ouverte && !_annule){
      if(racine.classList.contains('ec-alarme')) alarmeDeBord(ms(1400));
    }
  });
})();
