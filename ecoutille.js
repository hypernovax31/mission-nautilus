/* =============================================================================
   ÉCOUTILLE — PAGE DE GARDE DU NAUTILUS  (ecoutille.js) — « garde v6 »

   Rôle
   ----
   Animer la page de garde décrite par le socle écrit dans le <head> de
   index.html (le style de l'écoutille ne dépend d'AUCUN fichier externe) :

     1. l'ordinateur de bord « tape » son journal pendant que l'alarme
        rouge bat sur la cloison ;
     2. le visiteur appuie sur le BOUTON ROUGE « START » — c'est ce geste
        qui ouvre le son du navigateur, et l'alarme du bord se fait enfin
        entendre le temps que la coque monte ;
     3. la coque blindée se lève d'un bloc, comme une porte de sas ;
     4. derrière elle, la lumière du sas — déjà là, mais cachée par la
        coque — est découverte d'un coup, puis s'efface en fondu : ce fondu
        EST l'apparition de l'accueil ;
     5. l'accueil du jeu est là, déjà animé derrière.

   DESSIN SIMPLE, ET C'EST VOULU
   -----------------------------
   La version précédente était un morceau de bravoure : un diaphragme de
   huit pales en SVG, une cloison trouée par un masque radial dont le rayon
   suivait l'ouverture, une « caméra » qui poussait dans le trou, un éclat
   final. Sur ordinateur, c'était joli. Sur iPhone, le métal et la lumière
   s'échappaient de l'écoutille à chaque ouverture : le découpage était
   perdu dès que l'élément qui le portait passait sur une couche de
   composition animée — et cet élément était justement celui qu'on animait.

   Ici, il n'y a plus que ce qui ne PEUT pas casser :
     · la coque est opaque : aucun masque, aucun trou, aucun découpage ;
     · l'ouverture est UN SEUL mouvement : translateY de la coque ;
     · la lumière est une couche opaque derrière la coque : elle est
       toujours là, la coque la cache, et il ne reste qu'un fondu pour la
       retirer — c'est la plus vieille animation du web ;
     · aucune image, aucun SVG animé, aucune mesure du navigateur.
   Autrement dit : transform et opacity, rien d'autre.

   Pourquoi une page de garde, au fait ?
   ------------------------------------
   Un navigateur n'autorise le son qu'après un VRAI geste de l'utilisateur.
   Le clic sur START est ce geste : il satisfait le guetteur de premier
   geste d'index.html (guetterPremierGeste / surPremierGeste), qui démasque
   l'ambiance sonore et prépare les sons du bord. Le site démarre donc avec
   le son, au lieu de rester muet jusqu'au premier clic de hasard.

   Le son, justement
   -----------------
   Si le joueur a coupé le sonar (localStorage['nautilusSoundOn'] === '0'),
   cette page est TOTALEMENT MUETTE : aucune lecture d'<audio>, aucun
   contexte Web Audio n'est même créé. La règle du site est absolue.

   Quand la revoit-on ?
   --------------------
   À CHAQUE chargement de l'accueil : à chaque chargement, le navigateur
   repart de zéro et refuse tout son tant qu'il n'a pas vu un vrai geste.
     · ?ecoutille=0 ou /ecoutille/passer → on la passe (silence assumé) ;
     · la classe « ec-passee », posée dans le <head> avant le premier
       rendu, ne sert qu'à ce cas-là : pas un pixel de clignotement.
   ============================================================================= */
(function(){
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. RÉGLAGES
   * ------------------------------------------------------------------ */
  const CLE_SESSION = 'nautilusEcoutille';        // ouverte pendant cette session
  const CLE_VUE     = 'nautilusEcoutilleVue';     // vue au moins une fois
  const CLE_FORCE   = 'nautilusEcoutilleForce';   // ordre exprès : « rejoue-la »

  /* Calendrier de l'ouverture, en millisecondes après le clic.
     Trois temps, pas un de plus :
       · 140 ms — la coque commence à se lever (le temps que le clic
         « résonne » : bruit de coque, bouton enfoncé) ;
       · 760 ms — la lumière du sas, découverte par la coque qui monte,
         commence à s'effacer : l'accueil apparaît dessous, pendant que la
         coque finit de monter ;
       · 1500 ms — la page de garde a fini sa vie, on la retire du DOM. */
  const T = {
    levee:       140,
    lueurSortie: 760,
    reveler:    1500
  };

  /* Tous les navigateurs du parc savent le dire ; le test est protégé pour
     qu'un moteur exotique ne fasse pas tomber la page de garde entière.
     Moins d'animation : tout reste, mais plus court. */
  const PASSE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const F = PASSE ? 0.4 : 1;
  const ms = v => Math.round(v * F);

  const html   = document.documentElement;
  const racine = document.getElementById('ecoutille');

  /* LE SOCLE A DÉJÀ PRIS LE RELAIS. Un mini-script écrit dans la page (voir
     « SOCLE — LE CLIC » dans index.html) a rendu le bouton rouge cliquable
     dès le chargement, au cas où ce fichier n'arriverait jamais. Il fait la
     même ouverture, en plus court ; nous, nous ajoutons les sons, le journal
     et la révélation. On lui retire donc la main — sinon un clic
     déclencherait les deux ouvertures à la fois. */
  if(typeof window.__ecoutilleSecours === 'function'){
    try{ window.__ecoutilleSecours(); }catch(e){}
  }

  /* La sentinelle posée dans le <head> d'index.html surveille ce drapeau :
     s'il n'est jamais levé (fichier absent, erreur de chargement), elle
     retire la page de garde au bout de 20 s. On ne laisse JAMAIS un
     visiteur enfermé derrière l'écoutille. */
  window.__ecoutillePrete = true;

  /* UN MINUTEUR, ET RIEN DE PLUS. Chaque étape de l'ouverture pose son
     minuteur, sans tenir de liste à nettoyer : ce qui resterait en route
     après l'ouverture ne peut rien casser (au pire il retire une classe
     déjà retirée). Les deux seuls minuteurs qu'il FAUT retenir sont ceux du
     battement d'alarme, pour pouvoir l'arrêter net — ils ont leur variable. */
  const plusTard = (fn, delai) => setTimeout(fn, delai);
  const P = delai => new Promise(res => plusTard(res, delai));

  /* ------------------------------------------------------------------ *
   * 2. STOCKAGE (tolérant : navigation privée, stockage plein…)
   * ------------------------------------------------------------------ */
  function noter(cle){
    try{ localStorage.setItem(cle, '1'); }catch(e){ /* mode privé */ }
    try{ sessionStorage.setItem(cle, '1'); }catch(e){ /* mode privé */ }
  }
  /* Le stockage peut être INTERDIT (navigation privée, réglages) : le lire
     sans protection ferait tomber la page de garde entière. */
  function dejaVue(){
    try{ return localStorage.getItem(CLE_VUE) === '1'; }catch(e){ return false; }
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

  /* Le verrou de coque : coup sourd + choc métallique. C'est le son du
     bouton : il tombe exactement sur le geste du joueur. */
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

  /* Le sas s'ouvre : souffle d'air qui monte, pendant que la coque se lève. */
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
        { t: 'SAS DU NAUTILUS — FERMÉ' },
        { t: 'PROCÉDURE D\'EMBARQUEMENT', alerte: true, court: true },
        { t: 'APPUIE SUR START POUR OUVRIR', alerte: true }
      ];
    }
    return [
      { t: 'POSTE DE PLONGÉE — ' + heureDeBord() },
      { t: 'COQUE 28,4 BARS · ÉQUIPAGE 4/4' },
      { t: 'SAS DU NAUTILUS — FERMÉ' },
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
   * 5. L'OUVERTURE : la coque se lève, la lumière passe
   * ------------------------------------------------------------------ */
  let _ouverte = false;

  function ouvrir(){
    if(_ouverte) return;
    _ouverte = true;
    _annule = true;                 /* le journal s'arrête net */

    const start = document.getElementById('ecStart');
    racine.classList.add('ec-presse');
    plusTard(() => racine.classList.remove('ec-presse'), 260);

    /* LE GESTE QUI DÉBLOQUE LE SON. C'est ici, et pas avant, que le
       navigateur accepte la première note : l'alarme de bord se fait donc
       entendre MAINTENANT, une dernière fois, le temps que la coque monte —
       il fallait un vrai geste pour l'entendre, et c'est celui-là. On coupe
       d'abord l'alarme de l'intro (s'il y en avait une) pour ne pas
       superposer deux battements. */
    sonCoup();
    couperAlarme();
    alarmeDeBord(ms(1100));

    /* — la coque se lève (un seul transform, côté CSS) — */
    plusTard(() => {
      racine.classList.add('ec-levee');
      sonSouffle(ms(1100));
      if(start) start.setAttribute('aria-disabled', 'true');
    }, ms(T.levee));

    /* — l'alerte s'éteint et la lumière du sas s'efface : c'est ce fondu
         qui révèle l'accueil — */
    plusTard(() => {
      racine.classList.remove('ec-alarme');
      racine.classList.add('ec-lumiere-sortie');
    }, ms(T.lueurSortie));

    plusTard(reveler, ms(T.reveler));
  }

  /* ------------------------------------------------------------------ *
   * 6. LA RÉVÉLATION : on rend l'accueil au visiteur
   * ------------------------------------------------------------------ */
  function reveler(){
    if(!racine || racine.dataset.rendu) return;
    racine.dataset.rendu = '1';

    html.classList.remove('ec-bloque');
    html.classList.add('ec-arrivee');
    /* L'onglet reprend son vrai nom : celui de l'accueil. */
    try{ if(window.__ecoutilleTitre) document.title = window.__ecoutilleTitre; }catch(e){}
    noter(CLE_SESSION);
    noter(CLE_VUE);
    /* L'ordre exprès ne doit servir qu'UNE fois : sinon « Revoir
       l'écoutille » rejouerait la garde à chaque rechargement. */
    try{ sessionStorage.removeItem(CLE_FORCE); }catch(e){}

    racine.classList.add('ec-passee');
    plusTard(() => { if(racine.parentNode) racine.remove(); }, 80);
    plusTard(couperLeSon, 900);

    try{
      window.dispatchEvent(new CustomEvent('nautilus:ecoutille-ouverte'));
    }catch(e){}
  }

  /* ------------------------------------------------------------------ *
   * 7. REVOIR L'ÉCOUTILLE (bouton du pied de page de l'accueil)
   * ------------------------------------------------------------------ */
  /* Ce bouton la ramène quand on veut : il efface le marqueur de session,
     pose un ordre exprès (au cas où l'adresse ne transporterait rien) et
     recharge. C'est aussi la sortie de secours si un jour l'adresse
     « ?ecoutille=1 » se perdait en route — proxy, lien raccourci,
     application installée. */
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
   * 8. MISE EN ROUTE
   * ------------------------------------------------------------------ */
  if(!racine){ return; }        /* page sans écoutille : rien à faire */

  /* L'ORDRE VIENT DE LA SENTINELLE DU <head> : c'est elle qui a décidé
     avant le premier rendu, et elle a posé sa réponse sur window. On la
     relit ici pour ne jamais rejouer un calcul qui pourrait diverger.
     (Repli : si un jour ecoutille.js était chargé sur une page sans
     sentinelle, on refait alors la même déduction.) */
  let jouer;
  if(typeof window.__ecoutilleJouer === 'boolean'){
    jouer = window.__ecoutilleJouer;
  }else{
    let adresse = '';
    try{ adresse = (location.pathname + location.search + location.hash).toLowerCase(); }catch(e){}
    const forcer = /ecoutille=(1|oui)/.test(adresse) || /\/ecoutille(\/|$)/.test(adresse);
    const passer = /ecoutille=(0|non)/.test(adresse) || /ecoutille\/(passer|fermer|non)/.test(adresse);
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

  html.classList.add('ec-bloque');

  const start = document.getElementById('ecStart');
  const passer = document.getElementById('ecPasser');

  /* L'alarme rouge bat dès le début : c'est elle qui donne l'urgence. */
  plusTard(() => {
    if(_ouverte) return;
    racine.classList.add('ec-alarme');
    alarmeDeBord(ms(2600));
  }, ms(650));

  /* Le journal se tape tout seul ; le bouton, lui, est actif tout de suite. */
  taperJournal(dejaVue());

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
