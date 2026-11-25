/* =============================================================
   MOTS CROISÉS MODERNES — moteur réutilisable (mots-croises.js)
   -------------------------------------------------------------
   Moteur autonome, piloté par les DONNÉES de la page (mots,
   positions, définitions) : le même moteur sert aux paliers
   suivants sans duplication.

   window.NautilusMotsCroises.init(hote, {
     mots: [ { num, dir:'h'|'v', row, col, reponse:'ALBUM',
               definition:'…' } ],
     maxErreurs: 3,                     // défaut 3
     onErreur(erreurs, max),            // appelé à chaque mot faux
     onMotValide(mot),                  // appelé à chaque mot trouvé
     onVictoire()                       // grille entièrement juste
   })

   ERGONOMIE « moderne » : clic sur une case OU une définition pour
   choisir le mot, surlignage or du mot actif, saisie qui avance
   toute seule EN SAUTANT les lettres déjà posées (croisements,
   cases verrouillées), retour arrière qui recule, validation
   automatique dès que le mot est COMPLET — même complété
   « par-dessus » un mot voisin : les cases passent alors TOUTES au
   vert. Mauvaise pioche = TOUTES les cases non verrouillées passent
   au rouge (secousse 0,5 s), puis 0,9 s après le mot se VIDE tout
   seul et se resélectionne : on le retape en entier (les lettres
   verrouillées par un croisement déjà validé, elles, restent en
   place et au vert). Définition validée = badge ✔ vert.
   AUCUNE image, AUCUNE dépendance.
   ============================================================= */
(function () {
  'use strict';

  var LETTRE = /^[A-Z]$/;   // réponses sans accents : l'entrée est normalisée

  function normaliser(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')   // é -> e
      .toUpperCase();
  }

  function init(hote, opts) {
    if (!hote) return null;
    opts = opts || {};
    var mots = opts.mots || [];
    var maxErreurs = Math.max(1, opts.maxErreurs || 3);

    /* ---------- Grille calculée depuis les données ---------- */
    var cellules = {};          // "r,c" -> { lettre, nums:[], h:idH, v:idV }
    var maxR = 0, maxC = 0;
    mots.forEach(function (m) {
      m.solution = normaliser(m.reponse);
      for (var i = 0; i < m.solution.length; i++) {
        var r = m.row + (m.dir === 'v' ? i : 0);
        var c = m.col + (m.dir === 'h' ? i : 0);
        var k = r + ',' + c;
        if (!cellules[k]) cellules[k] = { lettre: m.solution[i], nums: [], r: r, c: c };
        cellules[k][m.dir] = m.num;
        if (i === 0) cellules[k].nums.push(m.num);
        if (r > maxR) maxR = r;
        if (c > maxC) maxC = c;
      }
    });
    var NB_COLS = maxC + 1, NB_ROWS = maxR + 1;
    function caseDuMot(m) {
      var out = [];
      for (var i = 0; i < m.solution.length; i++) {
        out.push((m.row + (m.dir === 'v' ? i : 0)) + ',' + (m.col + (m.dir === 'h' ? i : 0)));
      }
      return out;
    }
    /* Mot présent sur une case (priorité au sens déjà actif). */
    function motSurCase(k, dirPref) {
      var cell = cellules[k];
      if (!cell) return null;
      if (dirPref && cell[dirPref]) return mots.find(function (m) { return m.num === cell[dirPref] && m.dir === dirPref; });
      var id = cell.h || cell.v;
      var dir = cell.h ? 'h' : 'v';
      return mots.find(function (m) { return m.num === id && m.dir === (cell.h ? 'h' : 'v'); });
    }

    /* ---------- État ---------- */
    var saisie = {};            // "r,c" -> lettre posée
    var verrouille = {};        // "r,c" -> true quand le mot est juste
    var motsJustes = {};        // num+dir -> true
    var actif = null;           // mot sélectionné
    var erreurs = 0;
    var fini = false;

    function casesActives() { return actif ? caseDuMot(actif) : []; }

    function peindre() {
      /* surlignage : curseur > mot actif > normal */
      hote.querySelectorAll('.mc-case').forEach(function (el) {
        el.classList.remove('mc-actif', 'mc-curseur');
      });
      if (!actif) return;
      casesActives().forEach(function (k) {
        var el = hote.querySelector('[data-k="' + k + '"]');
        if (el) el.classList.add('mc-actif');
      });
      var cur = hote.querySelector('[data-k="' + curseur + '"]');
      if (cur) cur.classList.add('mc-curseur');
      hote.querySelectorAll('.mc-def').forEach(function (el) {
        el.classList.toggle('mc-def-active', !!actif && el.dataset.num == actif.num && el.dataset.dir === actif.dir);
      });
    }

    var curseur = null;         // "r,c" courant
    function selectionner(mot, cellCible) {
      actif = mot;
      if (!mot) { peindre(); return; }
      var cases = caseDuMot(mot);
      curseur = (cellCible && cases.indexOf(cellCible) >= 0) ? cellCible
        : (cases.find(function (k) { return !saisie[k]; }) || cases[cases.length - 1]);
      peindre();
      var input = hote.querySelector('[data-k="' + curseur + '"] .mc-input');
      if (input) input.focus({ preventScroll: true });
    }

    function aller(delta) {
      if (!actif || !curseur) return;
      var cases = caseDuMot(actif);
      var i = cases.indexOf(curseur) + delta;
      if (i < 0 || i >= cases.length) return;
      curseur = cases[i];
      peindre();
      var input = hote.querySelector('[data-k="' + curseur + '"] .mc-input');
      if (input) input.focus({ preventScroll: true });
    }

    function validerMot(mot) {
      if (!mot || motsJustes[mot.dir + mot.num]) return;
      var cases = caseDuMot(mot);
      if (cases.some(function (k) { return !saisie[k]; })) return;  // incomplet
      var juste = cases.every(function (k, i) { return saisie[k] === mot.solution[i]; });
      if (juste) {
        motsJustes[mot.dir + mot.num] = true;
        cases.forEach(function (k) {
          verrouille[k] = true;
          var el = hote.querySelector('[data-k="' + k + '"]');
          if (el) {
            /* LE ROUGE REDEVIENT VERT : la marque d'erreur part AVEC la
               validation (oubli historique : .mc-faux restait posée et,
               déclarée APRÈS .mc-juste dans le CSS, gagnait la cascade —
               la case restait rouge malgré la bonne réponse). */
            el.classList.remove('mc-faux');
            el.classList.add('mc-juste');
            var input = el.querySelector('.mc-input');
            if (input) input.readOnly = true;
          }
        });
        var def = hote.querySelector('.mc-def[data-num="' + mot.num + '"][data-dir="' + mot.dir + '"]');
        if (def) def.classList.add('mc-def-ok');
        if (typeof opts.onMotValide === 'function') opts.onMotValide(mot);
        /* victoire ? */
        if (!fini && mots.every(function (m) { return motsJustes[m.dir + m.num]; })) {
          fini = true;
          hote.classList.add('mc-termine');
          if (typeof opts.onVictoire === 'function') opts.onVictoire();
          return;
        }
        /* mot suivant non résolu */
        var suivant = mots.find(function (m) { return !motsJustes[m.dir + m.num]; });
        if (suivant) selectionner(suivant);
      } else {
        erreurs++;
        /* RÈGLE « CODE MAGASIN » (demande explicite) : un mot COMPLET
           mais FAUX = TOUTES ses cases passent au rouge — pas seulement
           les lettres fautives (les cases verrouillées par un croisement
           déjà validé, elles, restent vertes). */
        cases.forEach(function (k) {
          if (verrouille[k]) return;
          var el = hote.querySelector('[data-k="' + k + '"]');
          if (el) {
            el.classList.remove('mc-faux');
            void el.offsetWidth;              /* relance l'animation */
            el.classList.add('mc-faux');
          }
        });
        if (typeof opts.onErreur === 'function') opts.onErreur(erreurs, maxErreurs);
        /* …puis « LE MOT SAUTE POUR RECOMMENCER » : après un court délai
           (le temps de VOIR le rouge, 0,9 s), les cases non verrouillées
           se VIDENT et le mot est resélectionné à sa première case vide —
           on retape le mot entier. */
        var motARelancer = mot;
        setTimeout(function () {
          if (fini) return;
          cases.forEach(function (k) {
            if (verrouille[k]) return;                /* croisement validé : il reste */
            saisie[k] = '';
            var el = hote.querySelector('[data-k="' + k + '"]');
            if (el) {
              el.classList.remove('mc-faux');
              var input = el.querySelector('.mc-input');
              if (input) input.value = '';
            }
          });
          selectionner(motARelancer);
        }, 900);
      }
    }

    /* ---------- Construction DOM ---------- */
    hote.innerHTML = '';
    hote.classList.add('mc');
    var grille = document.createElement('div');
    grille.className = 'mc-grille';
    grille.style.gridTemplateColumns = 'repeat(' + NB_COLS + ',1fr)';
    for (var r = 0; r < NB_ROWS; r++) {
      for (var c = 0; c < NB_COLS; c++) {
        var k = r + ',' + c;
        var cell = cellules[k];
        var d = document.createElement('div');
        if (!cell) { d.className = 'mc-vide'; grille.appendChild(d); continue; }
        d.className = 'mc-case';
        d.dataset.k = k;
        if (cell.nums.length) {
          var n = document.createElement('span');
          n.className = 'mc-num';
          n.textContent = cell.nums[0];
          d.appendChild(n);
        }
        var input = document.createElement('input');
        input.className = 'mc-input';
        input.maxLength = 1;
        /* DÉBORDEMENT CORRIGÉ : sans size=1, l'<input> garde sa taille
           intrinsèque (~20 caractères) et impose ce min-content aux
           pistes de la grille (min-width:auto) — les 13 colonnes ne
           pouvaient plus rétrécir et les cases DÉBORDAIENT du cadre
           doré sur petit écran. (Double sécurité : min-width:0 en CSS
           sur .mc-case ET .mc-input.) */
        input.size = 1;
        input.autocomplete = 'off';
        input.autocapitalize = 'characters';
        input.spellcheck = false;
        input.setAttribute('aria-label', 'Case ligne ' + (r + 1) + ' colonne ' + (c + 1));
        /* inp capturé en PARAMÈTRE de l'IIFE : « var input » est remonté
           à la fonction init — sans ce passage par paramètre, tous les
           écouteurs liraient la valeur du DERNIER input créé (bug réel,
           attrapé par le test sandbox). */
        (function (kk, dd, inp) {
          inp.addEventListener('focus', function () {
            /* RETAPER PAR-DESSUS une lettre déjà posée : le contenu de la
               case est présélectionné au focus — la frappe REMPLACE
               directement (autrement maxLength=1 bloquait purement toute
               saisie dans une case déjà remplie : la correction était
               impossible sans Backspace). Différé d'un cran pour survivre
               au « tap » tactile qui vide la sélection native. */
            setTimeout(function () { try { inp.select(); } catch (e) {} }, 0);
          });
          inp.addEventListener('input', function () {
            var v = normaliser(inp.value);
            var dernier = v.slice(-1);
            if (!LETTRE.test(dernier)) { inp.value = ''; return; }
            if (!actif) { inp.value = ''; return; }
            var cases = caseDuMot(actif);
            var idx = cases.indexOf(kk);
            /* Le mot était-il déjà COMPLET avant cette frappe ? Retaper
               une lettre dans un mot complet (correction après erreur)
               ne relance PAS la validation à chaque frappe : Enter ou la
               dernière case restent le déclencheur, comme avant. */
            var completAvant = cases.every(function (k) { return !!saisie[k]; });
            saisie[kk] = dernier;
            inp.value = dernier;
            /* VALIDATION « PAR-DESSUS » : on valide dès que le mot est
               COMPLET, quelle que soit la case frappée. Avant, seule la
               DERNIÈRE case déclenchait — or avec les croisements elle
               pouvait être déjà remplie ET verrouillée par un mot voisin,
               le mot complet n'était alors JAMAIS validé (cases jamais
               vertes). */
            var complet = cases.every(function (k) { return !!saisie[k]; });
            if (complet && (idx === cases.length - 1 || !completAvant)) { validerMot(actif); return; }
            /* Avancer à la prochaine case VIDE : les lettres déjà posées
               (croisements, cases verrouillées en lecture seule) sont
               sautées — la frappe ne tombe plus jamais sur une case
               figée où elle se perdait. */
            var cible = null;
            for (var j = idx + 1; j < cases.length && !cible; j++) if (!saisie[cases[j]]) cible = cases[j];
            if (!cible) for (var j2 = 0; j2 < cases.length && !cible; j2++) if (!saisie[cases[j2]]) cible = cases[j2];
            if (!cible) return;   /* mot complet sans validation (correction) : le curseur reste */
            curseur = cible;
            peindre();
            var suivante = hote.querySelector('[data-k="' + cible + '"] .mc-input');
            if (suivante) suivante.focus({ preventScroll: true });
          });
          inp.addEventListener('keydown', function (e) {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (saisie[kk] && !verrouille[kk]) { saisie[kk] = ''; inp.value = ''; }
              else aller(-1);
            } else if (e.key === 'Enter') { e.preventDefault(); validerMot(actif); }
            else if (e.key === 'ArrowRight' && actif && actif.dir === 'h') { e.preventDefault(); aller(1); }
            else if (e.key === 'ArrowLeft' && actif && actif.dir === 'h') { e.preventDefault(); aller(-1); }
            else if (e.key === 'ArrowDown' && actif && actif.dir === 'v') { e.preventDefault(); aller(1); }
            else if (e.key === 'ArrowUp' && actif && actif.dir === 'v') { e.preventDefault(); aller(-1); }
          });
          dd.addEventListener('click', function () {
            if (fini) return;
            var pref = (actif && curseur === kk) ? (actif.dir === 'h' ? 'v' : 'h') : (actif ? actif.dir : null);
            var m = motSurCase(kk, pref) || motSurCase(kk, null);
            if (m) selectionner(m, kk);
          });
        })(k, d, input);
        d.appendChild(input);
        grille.appendChild(d);
      }
    }

    /* ---------- Définitions ---------- */
    var defs = document.createElement('div');
    defs.className = 'mc-defs';
    [['h', '➡️ Horizontalement'], ['v', '⬇️ Verticalement']].forEach(function (g) {
      /* Chaque sens forme un GROUPE (Horizontalement / Verticalement) :
         la mise en page peut alors disposer les descriptions AUTOUR de
         la grille (deux colonnes côte à côte sur écran moyen, une seule
         sur mobile) au lieu d'une liste unique. */
      var groupe = document.createElement('div');
      groupe.className = 'mc-defs-group mc-defs-group--' + g[0];
      var titre = document.createElement('div');
      titre.className = 'mc-defs-titre';
      titre.textContent = g[1];
      groupe.appendChild(titre);
      mots.filter(function (m) { return m.dir === g[0]; }).forEach(function (m) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'mc-def';
        b.dataset.num = m.num;
        b.dataset.dir = m.dir;
        /* Définition NUE + BADGE DE VALIDATION : numéro en texte or,
           indice, et pastille ✔ verte qui apparaît (pop) quand le mot
           est trouvé — on voit D'UN COUP ce qui est validé. (Les
           pastilles numérotées, badges « nombre de lettres » et
           cryptogrammes restent retirés, choix visuel du Palier 2
           « Code Magasin ».) */
        b.innerHTML = '<span class="mc-def-numtxt">' + m.num + '.</span>'
          + '<span class="mc-def-txt">' + m.definition + '</span>'
          + '<span class="mc-def-check" aria-hidden="true">✔</span>';
        b.addEventListener('click', function () {
          if (fini) return;
          selectionner(m);
          /* Clic sur une définition → la page GLISSE jusqu'au haut de la
             grille : sur petit écran les définitions sont SOUS la grille,
             le mot choisi serait surligné hors champ. Le scroll-margin-top
             du CSS évite la topbar sticky. Inerte si la grille est déjà
             entièrement visible (grand écran, grille à droite). */
          if (typeof grille.scrollIntoView === 'function') {
            grille.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
        groupe.appendChild(b);
      });
      defs.appendChild(groupe);
    });

    hote.appendChild(grille);
    hote.appendChild(defs);

    return {
      /* Exports utiles aux tests et au pilotage page. */
      detruire: function () { hote.innerHTML = ''; hote.classList.remove('mc', 'mc-termine'); },
      etat: function () { return { erreurs: erreurs, fini: fini, motsJustes: Object.assign({}, motsJustes) }; },
      _internes: { cellules: cellules, caseDuMot: caseDuMot, selectionner: selectionner, validerMot: validerMot, mots: mots, saisie: saisie }
    };
  }

  window.NautilusMotsCroises = { init: init };
})();
