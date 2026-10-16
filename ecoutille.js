/* =============================================================================
   ÉCOUTILLE — ENTRÉE DU NAUTILUS  (ecoutille.js) — « garde v9 »

   Ce que fait ce fichier
   ----------------------
   Il joue la page de garde décrite par le socle écrit dans le <head> de
   index.html (le dessin ne dépend d'AUCUN fichier externe) :

     1. on entre par le hublot du salon du Nautilus : la nuit des grands
        fonds, les rais de lumière, les bulles, les échos du sonar, et le
        bateau noir qui traverse l'écran, ses hublots allumés ;
     2. la console du bord travaille : six cadrans qui DONNENT DES CHIFFRES
        réels ou calculés (l'horloge du visiteur, la pression déduite de
        l'immersion), et le journal de plongée sur une seule ligne, qui
        annonce ce que fait le bateau — plan par plan ;
     3. le visiteur frappe le BOUTON ROUGE « START » ;
     4. le projecteur du Nautilus nous éblouit : la lumière s'ouvre jusqu'à
        remplir l'écran, un éclair passe, puis son fondu découvre l'accueil —
        qui s'anime pendant que la lumière se retire ;
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
   le son, au lieu de rester muet jusqu'au premier clic de hasard.
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

  /* Calendrier de la sortie, en millisecondes après le clic. Cinq temps :
       · 130 ms — la plongée s'engage : le décor avance, le souffle monte ;
       · 540 ms — le projecteur s'allume (l'éblouissement s'ouvre) ;
       · 1050 ms — l'éclair de l'impact ;
       · 1500 ms — la lumière se retire : c'est le fondu qui révèle l'accueil ;
       · 2400 ms — la page de garde a fini sa vie, on la retire du DOM. */
  const T = {
    plongee:  130,
    eclat:    540,
    impact:  1050,
    sortie:  1500,
    retrait: 2400
  };

  /* La durée d'une boucle du film, en secondes : le journal de plongée
     raconte ce qui passe à l'image, il doit donc repartir avec elle. */
  const FILM_BOUCLE = 34.5;

  /* LE PROFIL DE PLONGÉE — crédible AVANT d'être spectaculaire.
     Un sous-marin ne tombe pas : il descend. On part donc d'une vitesse de
     descente réaliste (6 m/s au début, soit ~21 km/h — déjà rapide pour un
     bateau de 1866) qui faiblit à mesure que la coque se rapproche de sa
     profondeur d'équilibre : la fosse de 3 420 m. Sur trente secondes, le
     cadran passe de 0 à ~180 m : c'est peu, et c'est VRAI. Ce qu'un vrai
     poste de plongée montre, c'est un compteur qui monte doucement. */
  const PROFONDEUR_FOSSE = 3420;
  const VITESSE_PLONGEE   = 6;

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
   * 4. LA CONSOLE DU BORD : DES CHIFFRES QUI SONT VRAIS
   * ------------------------------------------------------------------ */
  /* Pourquoi des chiffres qui bougent ? Parce que c'est ce qui fait « vrai ».
     Un cadre qui affiche « Immersion 3 240 m » immobile est une image ; le
     même cadran dont le nombre descend, dont la pression suit — et elle est
     CALCULÉE (1 bar à la surface, puis 1 bar de plus tous les 10 m) — dont
     l'écho du sonar se rapproche, et dont l'horloge donne l'heure RÉELLE du
     visiteur, ne se lit plus comme un décor. C'est le bateau qui travaille.

     Et le journal, lui, raconte ce qui passe À L'ÉCRAN : chaque ligne tombe
     sur le plan du film qu'elle décrit (les amarres à l'entrée du Nautilus,
     le calmar quand il attaque, le salon quand on le voit…). Un vrai poste de
     plongée ne « défile » pas : il annonce.

     On ne touche que du texte et des transforms : jamais de mise en page. */
  const el = id => document.getElementById(id);
  const INSTRUMENTS = {
    immersion: { v: el('ecImmersion'), jauge: el('ecImmersionJauge') },
    pression:  { v: el('ecPression'),  jauge: el('ecPressionJauge') },
    echo:      { v: el('ecEcho'),      jauge: el('ecEchoJauge'), note: el('ecEchoNote') },
    ballast:   { v: el('ecBallast'),   jauge: el('ecBallastJauge') },
    cap:       { v: el('ecCap'),       jauge: el('ecCapJauge') },
    heure:     { v: el('ecHeure'),     jauge: el('ecHeureJauge') }
  };
  const journalBord = el('ecJournal');
  const timecode    = el('ecTimecode');

  /* 3 240 s'écrit 3 240 : une espace fine, comme sur un vrai cadran. */
  const chiffre = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
  const cadran  = document.querySelectorAll('.ec-cadran');
  const celAlerte = c => { if(cadran[c]) cadran[c].classList.add('ec-cadran-alerte'); };
  const celCalme  = c => { if(cadran[c]) cadran[c].classList.remove('ec-cadran-alerte'); };
  /* Accepte aussi bien un cadran ({v: nœud}) qu'un nœud nu (la petite note
     « rocher » de l'écho, qui n'a pas de valeur entre guillemets). */
  function poserTexte(inst, valeur){
    const nœud = inst && inst.v ? inst.v : inst;
    if(nœud && nœud.textContent !== valeur) nœud.textContent = valeur;
  }
  function poserJauge(inst, part){
    if(inst && inst.jauge) inst.jauge.style.transform = 'scaleX(' + Math.max(0, Math.min(1, part)).toFixed(3) + ')';
  }
  function deux(n){ return String(n).padStart(2, '0'); }

  /* LE JOURNAL DE PLONGÉE — chaque ligne tombe sur le plan qu'elle décrit. */
  const JOURNAL = [
    { t:  1.5, texte: 'Le Nautilus largue les amarres' },
    { t:  7.0, texte: 'Cap 217° — traversée du champ d\'algues' },
    { t: 12.0, texte: 'Alerte : calmar géant sur la coque', alerte: true },
    { t: 17.0, texte: 'Hublot — descente dans la lumière' },
    { t: 22.0, texte: 'Salon du bord : le capitaine observe la nuit' },
    { t: 27.0, texte: 'Fosse — 3 400 m sous la surface' },
    { t: 31.0, texte: 'Décompression du sas — appuie sur START', alerte: true, invite: true }
  ];

  let _instr = null;
  let _instrArretes = false;
  let _lignesDites = 0;
  let _cycle = 0;

  function ligneDuJournal(ligne){
    if(!journalBord) return;
    journalBord.textContent = ligne.texte;
    journalBord.classList.toggle('alerte', !!ligne.alerte);
    /* À la dernière ligne, le bouton appelle plus fort : c'est le moment
       d'ouvrir le sas. */
    if(ligne.invite) racine.classList.add('ec-invite');
  }

  function demarrerInstruments(){
    if(!racine || _instr) return;
    const t0 = Date.now();
    let dernierTC = '';
    const tic = () => {
      if(_instrArretes || _ouverte) return;
      const t   = (Date.now() - t0) / 1000;
      const duree = CALME ? 0.8 : 0.25;      /* moins d'animation : on ralentit */

      /* ── L'IMMERSION : le bord descend, puis se stabilise dans la fosse ──
         Le rythme est celui d'un vrai bateau qui plonge : quelques mètres par
         seconde au début, puis une descente qui s'installe. Pas de chute
         libre spectaculaire — un Nautilus ne tombe pas, il descend. */
      const immersion = PROFONDEUR_FOSSE * (1 - Math.exp(-t * VITESSE_PLONGEE / PROFONDEUR_FOSSE))
                      + 3 * Math.sin(t / 3.1);
      poserTexte(INSTRUMENTS.immersion, chiffre(immersion));
      poserJauge(INSTRUMENTS.immersion, immersion / PROFONDEUR_FOSSE);
      /* ── LA PRESSION : calculée depuis l'immersion, pas inventée ──────────
         1 bar à la surface, puis 1 bar de plus tous les 10 m : c'est la règle
         des océanographes, et c'est pour ça que les deux cadrans restent
         toujours d'accord entre eux. */
      const pression = 1 + immersion / 10.06;
      poserTexte(INSTRUMENTS.pression, pression.toFixed(1).replace('.', ','));
      poserJauge(INSTRUMENTS.pression, pression / 340);
      /* ── L'ÉCHO DU SONAR : la distance au fond, qui se rapproche à mesure
         que le bateau descend, avec le ballant de la houle au-dessus. Quand
         le fond remonte sous la quille, le cadran passe à l'alerte. */
      const echo = Math.max(80, 2600 - immersion * 0.72) + 90 * Math.sin(t / 6.5);
      poserTexte(INSTRUMENTS.echo, chiffre(echo));
      poserJauge(INSTRUMENTS.echo, 1 - echo / 2800);
      if(INSTRUMENTS.echo.note){
        const note = echo < 320 ? 'rocher' : (echo < 900 ? 'fond' : 'libre');
        poserTexte(INSTRUMENTS.echo.note, note);
      }
      if(echo < 320){ celAlerte(2); } else { celCalme(2); }
      /* ── LE BALLAST : se remplit pour descendre, puis respire ───────────── */
      const ballast = 62 + 14 * (1 - Math.exp(-t / 60)) + 2 * Math.sin(t / 5);
      poserTexte(INSTRUMENTS.ballast, chiffre(ballast));
      poserJauge(INSTRUMENTS.ballast, ballast / 100);
      /* ── LE CAP : un cap qui tient, avec la barre qui vit ──────────────── */
      const cap = 217 + 2.6 * Math.sin(t / 17);
      poserTexte(INSTRUMENTS.cap, chiffre(cap));
      poserJauge(INSTRUMENTS.cap, cap / 360);
      /* ── L'HORLOGE DE BORD : l'heure RÉELLE de la montre du visiteur ────── */
      const d = new Date();
      poserTexte(INSTRUMENTS.heure, deux(d.getHours()) + ':' + deux(d.getMinutes()) + ':' + deux(d.getSeconds()));
      poserJauge(INSTRUMENTS.heure, d.getSeconds() / 60);
      /* ── LE TIMECODE DU CADREUR : il compte, image par image, à 24 i/s ─── */
      let tc = '';
      if(timecode){
        const im = Math.floor(t * 24);
        tc = deux(Math.floor(t / 3600)) + ':' + deux(Math.floor(t / 60) % 60) + ':'
           + deux(Math.floor(t) % 60) + ':' + deux(im % 24);
        if(tc !== dernierTC){ timecode.textContent = tc; dernierTC = tc; }
      }
      /* ── LE JOURNAL : il annonce ce qui passe à l'image, et recommence
            quand le film recommence (il tourne en boucle, lui aussi) ──────── */
      const boucle = Math.floor(t / FILM_BOUCLE);
      if(boucle !== _cycle){ _cycle = boucle; _lignesDites = 0; }
      const dansLaBoucle = t - boucle * FILM_BOUCLE;
      while(_lignesDites < JOURNAL.length && dansLaBoucle >= JOURNAL[_lignesDites].t){
        ligneDuJournal(JOURNAL[_lignesDites]);
        _lignesDites++;
      }
      _instr = plusTard(tic, duree * 1000);
    };
    tic();
  }
  function arreterInstruments(){
    _instrArretes = true;
    if(_instr) clearTimeout(_instr);
    _instr = null;
    racine.classList.remove('ec-invite');
    if(journalBord){
      journalBord.textContent = 'Sas ouvert — bienvenue à bord';
      journalBord.classList.remove('alerte');
    }
  }

  /* ------------------------------------------------------------------ *
   * 5. LA SORTIE : le projecteur nous éblouit
   * ------------------------------------------------------------------ */
  let _ouverte = false;

  function ouvrir(){
    if(_ouverte) return;
    _ouverte = true;
    arreterInstruments();

    const start = document.getElementById('ecStart');
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

    /* — la plongée s'engage : le décor avance, l'eau s'engouffre — */
    plusTard(() => {
      racine.classList.add('ec-plongee');
      sonSouffle(ms(1400));
      if(start) start.setAttribute('aria-disabled', 'true');
    }, ms(T.plongee));

    /* — le projecteur s'allume — */
    plusTard(() => {
      racine.classList.add('ec-eclat');
      sonEcho();
    }, ms(T.eclat));

    /* — l'éclair de l'impact — */
    plusTard(() => racine.classList.add('ec-impact'), ms(T.impact));

    /* — la lumière se retire : c'est ce fondu qui révèle l'accueil — */
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

  /* La console travaille dès la première image ; le bouton, lui, est actif
     tout de suite — on peut ouvrir le sas sans attendre le film. */
  demarrerInstruments();
})();
