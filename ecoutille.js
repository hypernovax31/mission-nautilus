/* =============================================================================
   ÉCOUTILLE — ENTRÉE DU NAUTILUS  (ecoutille.js) — « COMMIT 014069 »

   Ce que fait ce fichier
   ----------------------
   Il joue la page de garde décrite par le socle écrit dans le <head> de
   index.html (le dessin ne dépend d'AUCUN fichier externe) :

     1. on entre par le hublot du salon du Nautilus : la nuit des grands
        fonds, les rais de lumière, les bulles, les échos du sonar, et le
        bateau noir qui traverse l'écran, ses hublots allumés ;
     2. derrière le verre du hublot, la mer vit (rais, caustiques, neige
        marine, bulles) pendant que le film tourne ; en haut, la jauge
        d'oxygène se vide au rythme réel de l'équipage pendant que le
        relèvement annonce le retour du signal ;
     3. le visiteur frappe le BOUTON ROUGE « OPEN » ;
     4. on plonge DANS le hublot : zoom cinématographique à l'intérieur du verre,
        flou progressif, assombrissement abyssal et letterbox — comme si l'on
        s'enfonçait sous l'océan. Lueur azur diffuse, puis fondu qui révèle l'accueil ;
     5. l'accueil du jeu est là, déjà en marche.

   RIEN QUI PUISSE CASSER — la leçon des versions précédentes
   ----------------------------------------------------------
   La première ouverture était un diaphragme de huit pales qui laissait
   échapper le métal et la lumière hors du hublot sur iPhone : son découpage
   était perdu dès que l'élément animé passait sur une couche de composition.
   Ici, il n'y a plus rien à découper du tout, et ce qui bouge (le décor,
   comme le code) ne bouge qu'en transform et en opacité :

     · aucun masque, aucun clip-path, aucune image : tout est dégradé CSS ;
     · le cadre de cuivre du hublot n'encadre rien — il ne peut donc rien
       laisser passer ;
     · le bateau, les bulles, les anneaux du sonar et la lumière de sortie
       sont des couches pleines, animées par transform et opacité seulement ;
     · les trois zones de texte sont empilées par le flux : jamais l'une
       sur l'autre.

   Pourquoi une page de garde, au fait ?
   -------------------------------------
   Un navigateur n'autorise le son qu'après un VRAI geste de l'utilisateur.
   Le clic sur START est ce geste : il satisfait le guetteur de premier geste
   d'index.html (guetterPremierGeste / surPremierGeste), qui démasque
   l'ambiance sonore et prépare les sons du bord. Le site démarre donc avec
   le son, au lieu de rester muet jusqu'au premier clic de hasard. Le socle
   retient au contraire tout geste hors START tant que l'écoutille est
   fermée : un clic dans le décor ne peut donc ni démasquer l'ambiance ni
   lancer l'ordre de mission en coulisses.
   C'est aussi le moment où l'alarme du bord peut enfin se faire entendre :
   avant le geste, aucun navigateur ne la jouerait.

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
   L'écoutille ne contient qu'UN SEUL élément interactif, le bouton START :
   tout ce qui n'ouvre pas le sas n'a rien à faire ici.
   ============================================================================= */
(function(){
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. RÉGLAGES
   * ------------------------------------------------------------------ */
  const CLE_SESSION = 'nautilusEcoutille';        // ouverte pendant cette session
  const CLE_FORCE   = 'nautilusEcoutilleForce';   // ordre exprès : « rejoue-la »

  /* Calendrier ultra-fluide : zoom continu 60fps, sortie douce (v014064) */
  const T = {
    plongee:   200,
    eclat:     620,
    impact:   1200,
    sortie:   2650,
    retrait:  3400
  };

  /* Tous les navigateurs du parc savent le dire ; le test est protégé pour
     qu'un moteur exotique ne fasse pas tomber la page de garde entière.
     Moins d'animation : tout reste, mais plus court. */
  const CALME = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const F = CALME ? 0.45 : 1;
  const ms = v => Math.round(v * F);

  const html   = document.documentElement;
  const racine = document.getElementById('ecoutille');

  /* LE SOCLE A DÉJÀ PRIS LE RELAIS. Un mini-script écrit dans la page (voir
     « SOCLE — LE CLIC » dans index.html) a rendu le bouton rouge cliquable
     dès le chargement, au cas où ce fichier n'arriverait jamais. Il fait la
     même sortie, en plus court ; nous, nous ajoutons le récit, les sons et
     la révélation. On lui retire donc la main — sinon un clic déclencherait
     les deux sorties à la fois. */
  if(typeof window.__ecoutilleSecours === 'function'){
    try{ window.__ecoutilleSecours(); }catch(e){}
  }

  /* La sentinelle posée dans le <head> d'index.html surveille ce drapeau :
     s'il n'est jamais levé (fichier absent, erreur de chargement), elle
     retire la page de garde au bout de 20 s. On ne laisse JAMAIS un
     visiteur enfermé derrière le hublot. */
  window.__ecoutillePrete = true;

  /* UN MINUTEUR, ET RIEN DE PLUS. Chaque étape pose son minuteur, sans tenir
     de liste à nettoyer : ce qui resterait en route après la sortie ne peut
     rien casser (au pire il retire une classe déjà retirée). Les deux seuls
     minuteurs qu'il FAUT retenir sont ceux du battement d'alarme, pour
     pouvoir l'arrêter net — ils ont leur variable. */
  const plusTard = (fn, delai) => setTimeout(fn, delai);

  /* ------------------------------------------------------------------ *
   * 2. STOCKAGE (tolérant : navigation privée, stockage plein…)
   * ------------------------------------------------------------------ */
  /* Le stockage peut être INTERDIT (navigation privée, réglages) : le lire
     ou l'écrire sans protection ferait tomber la page de garde entière. */
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
    const n = Math.floor(ctx.sampleRate * 1.6);
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

  /* LE VERROU DE COQUE : coup sourd + choc métallique. C'est le son du
     bouton : il tombe exactement sur le geste du joueur. */
  function sonCoup(){
    const ctx = contexte(); if(!ctx) return;
    try{
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(160, t0);
      o.frequency.exponentialRampToValueAtTime(34, t0 + .34);
      const g = ctx.createGain();
      g.gain.setValueAtTime(.0001, t0);
      g.gain.exponentialRampToValueAtTime(.8, t0 + .012);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + .55);
      o.connect(g).connect(ctx.destination);
      o.start(t0); o.stop(t0 + .6);

      const n = sourceBruit(ctx, t0, .18);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass';
      f.frequency.value = 1250; f.Q.value = 1.1;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(.4, t0);
      ng.gain.exponentialRampToValueAtTime(.0001, t0 + .18);
      n.connect(f).connect(ng).connect(ctx.destination);
    }catch(e){ /* un navigateur sans Web Audio ne doit pas casser la page */ }
  }

  /* L'ÉCHO DU SONAR : un « ping » clair, long à s'éteindre. C'est le signal
     du bord qui répond au geste du joueur. */
  function sonEcho(){
    const ctx = contexte(); if(!ctx) return;
    try{
      const t0 = ctx.currentTime;
      const jouer = (debut, force) => {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(1180, debut);
        o.frequency.exponentialRampToValueAtTime(880, debut + 1.5);
        const g = ctx.createGain();
        g.gain.setValueAtTime(.0001, debut);
        g.gain.exponentialRampToValueAtTime(force, debut + .02);
        g.gain.exponentialRampToValueAtTime(.0001, debut + 1.7);
        o.connect(g).connect(ctx.destination);
        o.start(debut); o.stop(debut + 1.75);
      };
      jouer(t0, .22);
      jouer(t0 + .42, .07);        /* l'écho, plus loin dans la coque */
    }catch(e){}
  }

  /* L'EAU QUI S'ENGOUFFRE : souffle large qui monte, pendant que la plongée
     s'engage. */
  function sonSouffle(duree){
    const ctx = contexte(); if(!ctx) return;
    try{
      const t0 = ctx.currentTime, d = duree / 1000;
      const n = sourceBruit(ctx, t0, d + .2);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = .8;
      f.frequency.setValueAtTime(220, t0);
      f.frequency.exponentialRampToValueAtTime(2600, t0 + d);
      const g = ctx.createGain();
      g.gain.setValueAtTime(.0001, t0);
      g.gain.linearRampToValueAtTime(.28, t0 + d * .8);
      g.gain.linearRampToValueAtTime(.0001, t0 + d + .18);
      n.connect(f).connect(g).connect(ctx.destination);
    }catch(e){}
  }

  function couperLeSon(){
    if(_ctx){ try{ _ctx.close(); }catch(e){} _ctx = null; _bruit = null; }
  }

  /* L'ALARME DU BORD : on réutilise le lecteur <audio> du site (même
     fichier, même volume que le reste du jeu) au lieu d'en créer un second.
     Fond de sortie puis remise à zéro : la page retrouve son lecteur intact
     pour ses propres alarmes. */
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
   * 4. LE BANDEAU DU BORD
   * ------------------------------------------------------------------ */
  /* Le tableau de bord à six cadrans a été retiré, sur décision du joueur.
     Restent deux choses, en haut de la garde : la JAUGE D'OXYGÈNE (à gauche)
     et le relèvement du signal (à droite).

     La jauge n'est pas un décor : elle se calcule. Un homme au repos consomme
     0,30 litre d'oxygène par minute ; l'équipage du Nautilus compte vingt
     hommes, soit 6 litres par minute. La réserve nominale des soutes est de
     6 000 litres ; il en reste 5 880 à l'ouverture de la garde (98 %), de
     quoi tenir seize heures vingt. Le chiffre baisse donc pour de vrai,
     et la lumière de la piste suit.

     Le timecode qui occupait la droite du bandeau a été retiré : il pouvait
     passer pour un compteur de mission. Il ne reste ici que la réserve du
     bord, en litres, et le relèvement du signal ; le compte à rebours commun
     vit dans le panneau « Réserve O₂ » de l’accueil, après START.

     Un seul minuteur, qui ne touche que la valeur en litres et une transformation —
     rien d'autre ne bouge sur la page. Pas de bandeau (page sans garde) :
     il ne se passe rien. */
  const O2_RESERVE_L   = 6000;  /* capacité nominale des soutes, en litres */
  const O2_DEPART_L    = 5880;  /* ce qu'il reste au chargement de la garde */
  const O2_CONSO_L_MIN = 6;     /* vingt hommes × 0,30 L/min, au repos */
  const o2Valeur = document.getElementById('ecO2Valeur');
  const o2Niveau = document.getElementById('ecO2Niveau');
  let _cadreur = null;      /* minuteur du bandeau (null : pas encore lancé) */
  let _cadreurMort = false;
  let _o2Litres = -1;       /* dernier chiffre écrit (on n'écrit que s'il change) */
  let _o2Echelle = -1;      /* dernière échelle posée sur la piste */

  function demarrerCadreur(){
    if(!o2Niveau || _cadreur) return;
    const t0 = Date.now();
    const tic = () => {
      if(_cadreurMort || _ouverte) return;
      const t  = (Date.now() - t0) / 1000;
      majOxygene(t);
      _cadreur = plusTard(tic, CALME ? 1000 : 250);
    };
    tic();
  }

  /* La réserve ne descend jamais sous zéro : même après une veille de
     plusieurs jours, l'instrument ne peut pas afficher un chiffre absurde. */
  function majOxygene(t){
    if(!o2Niveau) return;
    const litres = Math.max(0, O2_DEPART_L - O2_CONSO_L_MIN * t / 60);
    const echelle = Number((litres / O2_RESERVE_L).toFixed(4));
    if(echelle !== _o2Echelle){
      _o2Echelle = echelle;
      o2Niveau.style.transform = 'scaleX(' + echelle + ')';  /* transform seul */
    }
    const arrondi = Math.round(litres);
    if(o2Valeur && arrondi !== _o2Litres){
      _o2Litres = arrondi;
      o2Valeur.textContent = milliers(arrondi) + ' L';
    }
  }
  /* 5 880 s'écrit avec une espace fine insécable, comme sur un cadran. */
  function milliers(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f'); }

  function arreterCadreur(){
    _cadreurMort = true;
    if(_cadreur) clearTimeout(_cadreur);
    _cadreur = null;
  }
  // Vraie jauge O₂ (mission réelle) — appelée depuis index.html quand Firestore répond
  // ratio01 : 0..1 (1 = 100% → 6000 L), litres : optionnel, sinon déduit de ratio
  window.nautilusSetEcoutilleO2 = function(ratio01, litres){
    arreterCadreur();
    const ratio = Math.max(0, Math.min(1, Number(ratio01) || 0));
    if(o2Niveau && ratio !== _o2Echelle){
      _o2Echelle = ratio;
      o2Niveau.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
    }
    let lit = litres;
    if(lit == null && ratio01 != null) lit = Math.round(O2_RESERVE_L * ratio);
    if(o2Valeur && lit != null){
      const arrondi = Math.round(lit);
      if(arrondi !== _o2Litres){
        _o2Litres = arrondi;
        o2Valeur.textContent = milliers(arrondi) + ' L';
      }
    }
  };
  window.nautilusStopEcoutilleO2 = arreterCadreur;

  /* ------------------------------------------------------------------ *
   * 5. LA PLONGÉE : zoom dans le hublot + flou d'abysses
   * ------------------------------------------------------------------ */
  let _ouverte = false;

  function ouvrir(){
    if(_ouverte) return;
    _ouverte = true;
    arreterCadreur();

    const start = document.getElementById('ecStart');
    /* Rouge → vert : le geste valide l'embarquement (cinéphile : on garde le film, on change la lumière) */
    try{ racine.classList.add('ec-ouvert'); if(start) start.classList.add('is-ouvert'); }catch(e){}
    racine.classList.add('ec-presse');
    plusTard(() => racine.classList.remove('ec-presse'), 260);

    /* LE GESTE QUI DÉBLOQUE LE SON. C'est ici, et pas avant, que le
       navigateur accepte la première note : le verrou de coque tombe sous le
       doigt, l'alarme du bord se fait enfin entendre, et l'écho du sonar
       répond. On coupe d'abord l'alarme en cours pour ne rien superposer. */
    sonCoup();
    couperAlarme();
    alarmeDeBord(ms(1300));

    /* Le film, lui, reste MUET — mais on relance sa lecture au passage : si
       le navigateur l'avait refusée (batterie faible, économie d'énergie),
       ce geste la débloque. C'est le même geste pour tout. */
    if(film){
      try{
        const lecture = film.play();
        if(lecture && typeof lecture.catch === 'function') lecture.catch(() => {});
      }catch(e){}
    }

    /* — la plongée s'engage : zoom + eau — fluide, sans reflow forcé — */
    try{ racine.style.willChange = 'transform, opacity'; }catch(e){}
    requestAnimationFrame(() => requestAnimationFrame(() => {
      racine.classList.add('ec-plongee');
    }));
    plusTard(() => {
      racine.classList.add('ec-eclat');
      sonEcho();
    }, ms(T.eclat));
    plusTard(() => {
      sonSouffle(ms(1400));
      if(start) start.setAttribute('aria-disabled', 'true');
    }, ms(T.plongee));

    /* — on s'enfonce : zoom massif fluide — */
    plusTard(() => {
      racine.classList.add('ec-impact');
    }, ms(T.impact));

    /* — l'abyss se referme : fondu qui révèle l'accueil — */
    plusTard(reveler, ms(T.sortie));

    /* — puis la page de garde disparaît pour de bon — */
    plusTard(retirer, ms(T.retrait));
  }

  /* ------------------------------------------------------------------ *
   * 6. LA RÉVÉLATION, PUIS LE RETRAIT
   * ------------------------------------------------------------------ */
  function reveler(){
    if(!racine || racine.dataset.rendu) return;
    racine.dataset.rendu = '1';

    html.classList.remove('ec-bloque');
    html.classList.add('ec-arrivee');
    /* L'onglet reprend son vrai nom : celui de l'accueil. */
    try{ if(window.__ecoutilleTitre) document.title = window.__ecoutilleTitre; }catch(e){}
    noter(CLE_SESSION);
    /* L'ordre exprès ne doit servir qu'UNE fois : sinon « Revoir le
       Nautilus » rejouerait la garde à chaque rechargement. */
    try{ sessionStorage.removeItem(CLE_FORCE); }catch(e){}

    racine.classList.add('ec-sortie');

    try{
      window.dispatchEvent(new CustomEvent('nautilus:ecoutille-ouverte'));
    }catch(e){}
  }

  function retirer(){
    if(!racine) return;
    racine.classList.add('ec-passee');
    plusTard(() => { if(racine.parentNode) racine.remove(); }, 90);
    plusTard(couperLeSon, 900);
  }

  /* ------------------------------------------------------------------ *
   * 7. REVOIR LE NAUTILUS (bouton du pied de page de l'accueil)
   * ------------------------------------------------------------------ */
  /* Ce bouton le ramène quand on veut : il efface le marqueur de session,
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
  if(!racine){ return; }        /* page sans page de garde : rien à faire */

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

  /* LE FILM DE FOND : muet, en boucle, sans aucune commande. On ne le montre
     qu'une fois qu'il joue vraiment — sinon, un rectangle noir apparaîtrait
     avant le premier plan (l'affiche du fond, elle, est là tout de suite). */
  const film = racine.querySelector('.ec-film');
  if(film){
    /* Le socle de secours a déjà posé le bon format ; on vérifie quand même :
       si la page a été ouverte par un moteur exotique, ou si le socle a été
       purgé, c'est ici que le format se décide — et le choix est le même :
       téléphone debout = montage vertical, tout le reste = montage large. */
    const voulu = (window.matchMedia && window.matchMedia('(orientation: portrait)').matches)
      ? 'assets/film-nautilus-P.mp4?v=2' : 'assets/film-nautilus-L.mp4?v=2';
    if(film.getAttribute('src') !== voulu){ film.setAttribute('src', voulu); }
    const montreLeFilm = () => racine.classList.add('ec-film-pret');
    if(film.readyState >= 2) montreLeFilm();
    film.addEventListener('playing', montreLeFilm);
    film.addEventListener('loadeddata', montreLeFilm);
  }

  const start = document.getElementById('ecStart');
  start?.addEventListener('click', ouvrir);
  start?.focus({ preventScroll: true });

  /* Le bandeau du cadreur compte dès la première image ; le bouton, lui, est
     actif tout de suite — on peut ouvrir le sas sans attendre le film. */
  demarrerCadreur();
})();
