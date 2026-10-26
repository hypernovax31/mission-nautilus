/* =====================================================================
   ARTEFACT DU NAUTILUS — JEU DU PALIER 3  (artefact-palier3.js)

   « Les escales secrètes du Nautilus » : une chasse à l'ouvrage.
   Le Nautilus désigne un livre présent dans le magasin où joue
   l'équipage. Le matelot doit :

     1. déduire le RAYON grâce à une énigme (jamais nommée) ;
     2. retrouver l'ouvrage dans le magasin ;
     3. le présenter au SCEAU : scan du code-barres (EAN) ;
     4. confirmer ce qu'il voit sur la couverture (sans ouvrir) ;
     5. résoudre la SIGNATURE de l'ouvrage ;
     6. ouvrir la CHAMBRE FORTE avec le code final.

   RÈGLES DE JEU (rappel — tout est calculé par artefact-moteur.js)
     · 3ᵉ raté → remontée forcée en surface (1 h, puis 2 h, puis 4 h…)
       et passage de relais à un autre membre de l'équipage ;
     · un code-barres illisible ou une réponse vide ne compte PAS pour
       un raté : on ne punit pas la caméra du téléphone ;
     · trois indices payants (le rayon 1 h, l'édition 2 h, l'auteur 4 h) :
       chacun exige un sacrifice volontaire et confirmé ;
     · « Livre introuvable » : signalement au capitaine, AUCUNE erreur ;
     · si l'ouvrage disparaît, le capitaine en affecte un autre : la
       progression compatible est conservée, aucun raté n'est ajouté.

   CE QUE CE FICHIER NE CONTIENT JAMAIS
     Ni titre d'ouvrage, ni EAN, ni SKU, ni catégorie Fnac, ni nom de
     rayon, ni réponse. Les vérifications se font sur des EMPREINTES
     salées (artefact-moteur.js) : la page reste muette même lue de
     bout en bout.

   Lecture du code-barres : BarcodeDetector natif quand il existe,
   sinon ZXing (même CDN que le lecteur QR du sas), sinon saisie des
   13 chiffres imprimés sous les barres. Trois chemins, une seule
   réponse envoyée : le code lui-même, jamais une photo.
   ===================================================================== */
(function () {
  'use strict';
  if (window.NautilusArtefactJeu) return;

  var M = window.NautilusArtefactMoteur;
  var URL_ZXING = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.19.3/umd/index.min.js';

  /* ------------------------------------------------------------------
     LECTURE DU CODE-BARRES
     ------------------------------------------------------------------ */
  function detecteurNatifDisponible() {
    try {
      if (typeof BarcodeDetector === 'undefined') return Promise.resolve(false);
      return BarcodeDetector.getSupportedFormats().then(function (f) {
        return (f || []).indexOf('ean_13') >= 0;
      }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  function chargerScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url; s.async = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () { reject(new Error('lecteur introuvable')); };
      document.head.appendChild(s);
    });
  }

  /* Démarre la caméra et renvoie { arreter } ; `onCode` reçoit le code
     lu. Aucun flux vidéo n'est enregistré ni envoyé. */
  function demarrerLecteur(video, onCode, onErreur) {
    var arrete = false, flux = null, detecteur = null, lecteur = null, boucle = null;

    function finir() {
      arrete = true;
      if (boucle) clearTimeout(boucle);
      if (lecteur && lecteur.reset) { try { lecteur.reset(); } catch (e) {} }
      if (flux) { flux.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); }
      if (video) { video.srcObject = null; }
    }
    function signaler(code) {
      var propre = M.eanNormalise(code);
      if (!propre) return;
      if (!M.eanValide(propre)) return;         // lecture partielle : on continue
      finir();
      onCode(propre);
    }

    return navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      ? navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        })
      : Promise.reject(new Error('caméra indisponible'))
      .then(function (f) {
        if (arrete) { f.getTracks().forEach(function (t) { t.stop(); }); return { arreter: finir }; }
        flux = f;
        video.srcObject = f;
        video.setAttribute('playsinline', '');
        return video.play().catch(function () {}).then(function () {
          return detecteurNatifDisponible().then(function (natif) {
            if (natif) {
              detecteur = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] });
              (function tick() {
                if (arrete) return;
                detecteur.detect(video).then(function (codes) {
                  (codes || []).forEach(function (c) { signaler(c.rawValue); });
                }).catch(function () {}).then(function () {
                  if (!arrete) boucle = setTimeout(tick, 260);
                });
              })();
              return { arreter: finir, moteur: 'BarcodeDetector' };
            }
            return chargerScript(URL_ZXING).then(function () {
              if (arrete) return { arreter: finir };
              var ZX = window.ZXing;
              if (!ZX || !ZX.BrowserMultiFormatReader) throw new Error('lecteur ZXing incomplet');
              var hints = new Map();
              hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS,
                [ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8, ZX.BarcodeFormat.UPC_A]);
              hints.set(ZX.DecodeHintType.TRY_HARDER, true);
              lecteur = new ZX.BrowserMultiFormatReader(hints, 300);
              return lecteur.decodeFromVideoElement(video, function (resultat, err) {
                if (resultat && resultat.getText) signaler(resultat.getText());
              }).then(function () { return { arreter: finir, moteur: 'ZXing' }; });
            }).catch(function () {
              /* Ni détecteur natif, ni ZXing (hors ligne) : la saisie
                 manuelle reste disponible, elle est même plus sûre. */
              finir();
              return { arreter: finir, moteur: 'manuel' };
            });
          });
        });
      })
      .catch(function (e) {
        if (onErreur) onErreur(e && e.name === 'NotAllowedError' ? 'autorisation-refusee' : 'indisponible');
        return { arreter: finir, moteur: 'manuel' };
      });
  }

  /* ------------------------------------------------------------------
     LE JEU
     ------------------------------------------------------------------ */
  function init(hote, opts) {
    var o = opts || {};
    var service = o.service || window.NautilusArtefact;
    var magasins = o.magasins || window.NautilusMagasin;
    var journal = o.journal || function () {};
    var onVictoire = o.onVictoire || function () {};
    var onRemontee = o.onRemontee || function () {};
    var onErreurComptee = o.onErreurComptee || function () {};
    var onSacrifice = o.onSacrifice || function () { return Promise.resolve({ accepte: false }); };
    var onMagasinChoisi = o.onMagasinChoisi || null;
    var signalerCapitaine = o.signalerCapitaine || function () {};

    // Magasin lié à la page de démarrage : localStorage + ?magasin=ID en fallback
    function magasinDepuisURL(){
      try{
        var m=(location.search.match(/[?&]magasin=([^&]+)/)||[])[1];
        if(m) return decodeURIComponent(m);
        var m2=(location.search.match(/[?&]magasinId=([^&]+)/)||[])[1];
        if(m2) return decodeURIComponent(m2);
      }catch(e){}
      return null;
    }
    var magURL = magasinDepuisURL();
    var magCourant = (magasins && magasins.courant && magasins.courant()) || null;
    if(!magCourant && magURL) magCourant = { id: magURL, nom: magURL };
    var etat = {
      session: null, magasin: o.magasin || magCourant || null,
      t0: Date.now(), erreurs: 0, indices: [], vue: 'chargement', lecteur: null,
      detruit: false
    };
    // Délégation robuste : tous les boutons du mini-jeu passent par hote (survit aux rendre())
    if(hote && !hote._nautilusDelegue){
      hote._nautilusDelegue = true;
      hote.addEventListener('click', function(e){
        var t = e.target;
        while(t && t !== hote){
          if(t.id === 'afIntrouvable'){ e.preventDefault(); vueIntrouvable(); return; }
          if(t.id === 'afTrouve'){ e.preventDefault(); vueSceau(); return; }
          if(t.id === 'afMagasinOk'){
            e.preventDefault();
            var deja = etat.magasin || (magasins && magasins.courant && magasins.courant()) || null;
            if(deja && deja.id){
              journal('📍 Magasin confirmé pour cette plongée : <b>' + echapper(deja.nom||deja.id) + '</b>.', 'info');
              Promise.resolve(onMagasinChoisi ? onMagasinChoisi(deja) : null).catch(function(){}).then(function(){ charger(); });
            }
            return;
          }
          if(t.id === 'afHintBtn'){ e.preventDefault(); var _next=null; for(var _k=0;_k<M.INDICES.length;_k++){ if((etat.indices||[]).indexOf(M.INDICES[_k].cle)<0){ _next=M.INDICES[_k].rang; break; } } if(_next) proposerSacrifice(_next); return; }
          if(t.dataset && t.dataset.indice){ e.preventDefault(); proposerSacrifice(Number(t.dataset.indice)); return; }
          t = t.parentElement;
        }
      });
    }

    function echapper(s) { return M.echapper(s); }
    function lignes(s) { return echapper(s).replace(/\n/g, '<br>'); }

    function rendre(html) {
      if (etat.detruit || !hote) return;
      arreterLecteur();
      hote.innerHTML = html;
    }

    function arreterLecteur() {
      if (etat.lecteur && etat.lecteur.arreter) { try { etat.lecteur.arreter(); } catch (e) {} }
      etat.lecteur = null;
    }

    /* --- bandeau permanent : tentatives restantes + actions --------- */
    function pupitre(opts) {
      opts = opts || {};
      var max = (etat.session && etat.session.cartouche && etat.session.cartouche.maxErreurs) || M.MAX_ERREURS;
      var restantes = Math.max(0, max - etat.erreurs);
      var perdues = Math.max(0, max - restantes);
      var points = '';
      for (var i = 0; i < max; i++) {
        points += '<span class="af-jauge-pt' + (i < perdues ? ' is-lost is-grille' : '') + '" aria-hidden="true"></span>';
      }
      var jaugeEtat = restantes === 0 ? ' is-critical' : (restantes === 1 ? ' is-warning' : '');
      var jaugePart = '';
      if (!opts.sansJauge) {
        jaugePart = '<div class="af-jauge' + jaugeEtat + '" role="status" aria-label="Tentatives restantes">'
          + '<span class="af-jauge-label">Tentatives avant remontée</span>'
          + '<span class="af-jauge-points">' + points + '</span>'
          + '<span class="af-jauge-count" style="margin-left:8px;font:700 11px ui-monospace,Menlo,monospace;color:#cfe8ff;opacity:.9">' + restantes + ' / ' + max + '</span>'
          + '</div>';
      }
      var indicesFaits = etat.indices || [];
      var transmis = (etat.session && etat.session.indicesTransmis) || {};
      var blocTransmis = '';
      M.INDICES.forEach(function (ind) {
        var texte = transmis[ind.cle];
        var paye = indicesFaits.indexOf(ind.cle) >= 0;
        /* L'aide de méthode ne s'affiche QU'APRÈS le sacrifice : elle est
           présente dans la cartouche publique (elle ne nomme jamais le
           rayon, l'édition ni l'auteur), mais elle se mérite à l'écran. */
        var aide = paye ? ((etat.session && etat.session.cartouche && etat.session.cartouche.aides) || {})[ind.aide] : '';
        if (!paye && !texte) return;
        blocTransmis += '<div class="af-indice-transmis"><b>' + echapper(ind.titre) + '</b>'
          + (aide ? '<br>' + lignes(aide) : '')
          + (texte ? '<br>📯 ' + lignes(texte) : '') + '</div>';
      });
      // --- mise en page unifiée palier1 : morse-hint-target + morse-hints-grid (3 cartes) ---
      var cartes = M.INDICES.map(function(ind){
        var paye = indicesFaits.indexOf(ind.cle) >= 0;
        var texte = transmis[ind.cle] || '';
        var aide = paye ? ((etat.session && etat.session.cartouche && etat.session.cartouche.aides) || {})[ind.aide] || '' : '';
        var body = paye ? (aide ? lignes(aide) + (texte? '<br>📯 '+lignes(texte):'') : (texte? lignes(texte) : '— vu —')) : '— non révélé —';
        if(paye && !body) body = '— vu —';
        return '<div class="morse-hint-card '+(paye?'morse-hint-revealed':'')+'">'
          + '<div class="morse-hint-card-label">Indice nº'+ind.rang+' — '+echapper(ind.titre)+' '+(paye?'✓':'🔒')+'</div>'
          + '<div>'+body+'</div></div>';
      }).join('');
      var sceauFait = etat.session && Array.isArray(etat.session.etapesValidees) && etat.session.etapesValidees.indexOf('sceau') >= 0;
      var blocIntrouvable = sceauFait ? '' : '<div class="af-actions"><button type="button" class="af-btn af-btn--ghost" id="afIntrouvable">📵 Livre introuvable</button></div>';
      var allRevealed = indicesFaits.length >= M.INDICES.length;
      var nextRang = null;
      for(var k=0;k<M.INDICES.length;k++){ if(indicesFaits.indexOf(M.INDICES[k].cle)<0){ nextRang=M.INDICES[k].rang; break; } }
      var heuresProchain = nextRang ? (M.INDICES.filter(function(x){return x.rang===nextRang;})[0]||{}).heures||1 : 1;
      var blocIndices = '';
      if(!sceauFait){
        blocIndices = '<div class="morse-hint-target">'
          + '<div class="morse-hint-target-info">🆘 <b>Besoin d\'aide ?</b> Un indice est gagné par <b>tout l\'équipage</b>, mais celui qui le demande remonte en surface <b>'+heuresProchain+' h</b> et laisse sa place.</div>'
          + '<button class="morse-hint-btn" id="afHintBtn" '+(allRevealed?'disabled':'')+'>'+(allRevealed?'✅ Tous les indices révélés':'🆘 Demander un indice')+'</button>'
          + '</div><div class="morse-hints-grid">'+cartes+'</div>';
      } else {
        blocIndices = '<div class="morse-hints-grid">'+cartes+'</div>';
      }
      return '<div class="af-pupitre">'
        + jaugePart
        + blocIntrouvable
        + blocIndices
        + '</div>';
    }

    function jaugeHtml() {
      var max = (etat.session && etat.session.cartouche && etat.session.cartouche.maxErreurs) || M.MAX_ERREURS;
      var restantes = Math.max(0, max - etat.erreurs);
      var perdues = Math.max(0, max - restantes);
      var points = '';
      for (var i = 0; i < max; i++) {
        points += '<span class="af-jauge-pt' + (i < perdues ? ' is-lost is-grille' : '') + '" aria-hidden="true"></span>';
      }
      var jaugeEtat = restantes === 0 ? ' is-critical' : (restantes === 1 ? ' is-warning' : '');
      return '<div class="af-jauge' + jaugeEtat + '" role="status" aria-label="Tentatives restantes">'
        + '<span class="af-jauge-label">Tentatives avant remontée</span>'
        + '<span class="af-jauge-points">' + points + '</span>'
        + '<span class="af-jauge-count" style="margin-left:8px;font:700 11px ui-monospace,Menlo,monospace;color:#cfe8ff;opacity:.9">' + restantes + ' / ' + max + '</span>'
        + '</div>';
    }

    function brancherPupitre() {
      if (!hote) return;
      var introuvable = hote.querySelector('#afIntrouvable');
      if (introuvable) introuvable.addEventListener('click', vueIntrouvable);
      var hintBtn = hote.querySelector('#afHintBtn');
      if(hintBtn){
        hintBtn.addEventListener('click', function(){
          var next=null;
          for(var k=0;k<M.INDICES.length;k++){ if((etat.indices||[]).indexOf(M.INDICES[k].cle)<0){ next=M.INDICES[k].rang; break; } }
          if(next) proposerSacrifice(next);
        });
      }
      Array.prototype.forEach.call(hote.querySelectorAll('[data-indice]'), function (b) {
        b.addEventListener('click', function () { proposerSacrifice(Number(b.dataset.indice)); });
      });
    }

    /* --- écran : magasin — site-wide : on confirme, on ne re-choisit pas --- */
    function vueMagasin() {
      etat.vue = 'magasin';
      var deja = etat.magasin || (magasins && magasins.courant && magasins.courant()) || null;
      if (deja && deja.id) {
        var nomMag = deja.nom || deja.id;
        var villeMag = deja.ville ? ' — ' + deja.ville : '';
        var cpMag = deja.cp ? ' (' + deja.cp + ')' : '';
        rendre('<div class="af-carte">'
          + '<p class="af-kicker">Magasin de la mission</p>'
          + '<h3 class="af-titre">📍 Fnac ' + echapper(nomMag) + echapper(villeMag) + echapper(cpMag) + '</h3>'
          + '<p class="af-msg">Ce magasin a été choisi sur la <b>page de démarrage</b> et vaut <b>pour tout le site</b> (c’est ta géolocalisation de mission). L’ouvrage du Nautilus sera cherché <b>uniquement</b> dans ce magasin.<br>Tu peux le garder ou le changer.</p>'
          + '<div class="af-actions">'
          +   '<button type="button" class="af-btn af-btn--or" id="afMagasinOk">✔️ Confirmer et plonger</button>'
          +   '<a href="index.html" class="af-btn af-btn--ghost">📍 Changer de magasin</a>'
          + '</div>'
          + '</div>');
        var btn = hote.querySelector('#afMagasinOk');
        if(btn) btn.addEventListener('click', function(){
          etat.magasin = deja;
          journal('📍 Magasin confirmé pour cette plongée : <b>' + echapper(nomMag) + '</b>.', 'info');
          Promise.resolve(onMagasinChoisi ? onMagasinChoisi(deja) : null).catch(function(){}).then(function(){ charger(); });
        });
        return;
      }
      // Aucun magasin site-wide : on affiche le sélecteur intégré (thème) — choix unique pour tout le site
      rendre('<div class="af-carte">'
        + '<p class="af-kicker">Avant de plonger</p>'
        + '<h3 class="af-titre">' + lignes(M.MESSAGES.magasinRequis) + '</h3>'
        + '<p class="af-msg">Choisis ton magasin Fnac <b>une fois pour tout le site</b> : la sélection vaut pour le Palier 3 et tous les besoins géographiques. Le plus proche sera indiqué en tête si ta géolocalisation est disponible, sinon la liste est alphabétique.</p>'
        + '<div id="afMagasinHote"></div>'
        + '</div>');
      var sous = hote.querySelector('#afMagasinHote');
      if (magasins && magasins.monterSelecteur) {
        magasins.monterSelecteur(sous, {
          suggereGeo: true,
          onConfirme: function (fiche) {
            etat.magasin = fiche;
            journal('📍 Magasin de la mission : <b>' + echapper(fiche.nom) + '</b> — mémorisé pour tout le site.', 'info');
            Promise.resolve(onMagasinChoisi ? onMagasinChoisi(fiche) : null)
              .catch(function () {})
              .then(function () { charger(); });
          }
        });
      } else {
        sous.innerHTML = '<p class="af-msg warn">Le module des magasins n’est pas chargé.</p>';
      }
    }

    /* --- écran : aucun ouvrage compatible -------------------------- */
    function vueAucunOuvrage(message, detail) {
      etat.vue = 'aucun-ouvrage';
      rendre('<div class="af-carte af-carte--scellee">'
        + '<p class="af-kicker">SALLE DES MACHINES SILENCIEUSE</p>'
        + '<h3 class="af-titre">⛔ ' + lignes(message || M.MESSAGES.aucunOuvrage) + '</h3>'
        + (detail ? '<p class="af-msg">' + lignes(detail) + '</p>' : '')
        + '<div class="af-actions">'
        +   '<button type="button" class="af-btn" id="afReessayer">↻ Relancer la recherche</button>'
        +   '<button type="button" class="af-btn af-btn--ghost" id="afChangerMagasin">📍 Changer de magasin</button>'
        + '</div>'
        + '</div>');
      hote.querySelector('#afReessayer').addEventListener('click', charger);
      hote.querySelector('#afChangerMagasin').addEventListener('click', vueMagasin);
    }

    /* --- écran : mission suspendue (ouvrage introuvable) ----------- */
    function vueSuspendue(session) {
      etat.vue = 'suspendue';
      // Si la partie globale a démarré et que le joueur est hors magasin d'origine (>500 m ou changement de magasin),
      // on remplace le bouton « Reprendre la mission » par un message simple et concis.
      var G = window.NautilusMagasinGuard;
      if(G && G.verifierAcces){
        // vérification asynchrone : on affiche d'abord un état de chargement puis le bon message
        rendre('<div class="af-carte"><p class="af-kicker">Vérification du magasin</p><h3 class="af-titre">📍 Contrôle de position…</h3><p class="af-msg">Vérification de la distance au magasin d’origine.</p></div>');
        G.verifierAcces({ magasin: etat.magasin || (magasins && magasins.courant && magasins.courant()) || null }).then(function(info){
          if(etat.detruit) return;
          if(!info.autorise){
            rendre(G.messageHTML(info));
            var b=hote.querySelector('#afGuardRetry');
            if(b) b.addEventListener('click', function(){ vueSuspendue(session); });
            return;
          }
          var remplacement = session.remplacement;
          rendre('<div class="af-carte af-carte--scellee">'
            + '<p class="af-kicker">Mission suspendue</p>'
            + '<h3 class="af-titre">⏸️ ' + lignes(remplacement ? M.MESSAGES.replacement : M.MESSAGES.introuvable) + '</h3>'
            + '<p class="af-msg">Ton équipage ne perd rien : aucune erreur n’est comptée, la progression validée est conservée.</p>'
            + '<div class="af-actions">'
            +   '<button type="button" class="af-btn" id="afReessayer">↻ Reprendre la mission</button>'
            + '</div>'
            + '</div>');
          var btn=hote.querySelector('#afReessayer'); if(btn) btn.addEventListener('click', charger);
        }).catch(function(){
          // fail-open : on affiche le bouton classique si la vérification échoue
          var remplacement2 = session.remplacement;
          rendre('<div class="af-carte af-carte--scellee">'
            + '<p class="af-kicker">Mission suspendue</p>'
            + '<h3 class="af-titre">⏸️ ' + lignes(remplacement2 ? M.MESSAGES.replacement : M.MESSAGES.introuvable) + '</h3>'
            + '<p class="af-msg">Ton équipage ne perd rien : aucune erreur n’est comptée, la progression validée est conservée.</p>'
            + '<div class="af-actions">'
            +   '<button type="button" class="af-btn" id="afReessayer">↻ Reprendre la mission</button>'
            + '</div>'
            + '</div>');
          var btn2=hote.querySelector('#afReessayer'); if(btn2) btn2.addEventListener('click', charger);
        });
        return;
      }
      var remplacement = session.remplacement;
      rendre('<div class="af-carte af-carte--scellee">'
        + '<p class="af-kicker">Mission suspendue</p>'
        + '<h3 class="af-titre">⏸️ ' + lignes(remplacement ? M.MESSAGES.replacement : M.MESSAGES.introuvable) + '</h3>'
        + '<p class="af-msg">Ton équipage ne perd rien : aucune erreur n’est comptée, la progression validée est conservée.</p>'
        + '<div class="af-actions">'
        +   '<button type="button" class="af-btn" id="afReessayer">↻ Reprendre la mission</button>'
        + '</div>'
        + '</div>');
      hote.querySelector('#afReessayer').addEventListener('click', charger);
    }

    /* --- écran : l'indice du rayon -------------------------------- */
    function vueIndice() {
      var c = etat.session.cartouche;
      etat.vue = 'indice';
      var transmis = (etat.session.indicesTransmis || {}).rayon;
      rendre('<div class="af-carte">'
        + jaugeHtml()
        + '<p class="af-kicker">Journal de bord — première trace</p>'
        + '<h3 class="af-titre">🧭 L’indice du Nautilus</h3>'
        + '<blockquote class="af-enigme">' + lignes(c.indice) + '</blockquote>'
        + '<p class="af-msg">' + lignes(M.MESSAGES.lancement) + '</p>'
        + (transmis ? '<div class="af-indice-transmis"><b>Indice du capitaine :</b><br>' + lignes(transmis) + '</div>' : '')
        + '<div class="af-actions">'
        +   '<button type="button" class="af-btn af-btn--or" id="afTrouve">📖 J’ai l’ouvrage en main</button>'
        + '</div>'
        + pupitre({sansJauge:true})
        + '</div>');
      hote.querySelector('#afTrouve').addEventListener('click', vueSceau);
      brancherPupitre();
    }

    /* --- écran : le hublot (scan EAN) ------------------------------ */
    function vueSceau() {
      etat.vue = 'sceau';
      rendre('<div class="af-carte">'
        + jaugeHtml()
        + '<p class="af-kicker">Le hublot d\'identification</p>'
        + '<h3 class="af-titre">🔏 Passe l’ouvrage au hublot d\'identification</h3>'
        + '<p class="af-msg">' + lignes(M.MESSAGES.scanInvite) + '</p>'
        + '<div class="af-scanbox" id="afScanbox">'
        +   '<video id="afCam" class="af-cam" playsinline autoplay muted hidden></video>'
        +   '<div class="af-cam-placeholder" id="afCamPlaceholder"><span>📷</span>'
        +     '<b>Caméra en veille</b>Active la caméra pour présenter le code-barres, ou saisis ses chiffres.</div>'
        +   '<div class="af-scan-ligne" aria-hidden="true"></div>'
        + '</div>'
        + '<div class="af-actions">'
        +   '<button type="button" class="af-btn af-btn--or" id="afCamBtn">📸 Activer la caméra</button>'
        +   '<button type="button" class="af-btn af-btn--ghost" id="afManuelBtn">⌨️ Saisir les chiffres</button>'
        + '</div>'
        + '<div class="af-manuel" id="afManuel" hidden>'
        +   '<label for="afEan">Les 13 chiffres imprimés sous le code-barres</label>'
        +   '<input id="afEan" type="text" inputmode="numeric" autocomplete="off" maxlength="20" placeholder="9 781234 567890">'
        +   '<button type="button" class="af-btn" id="afEanOk">Passer au hublot d\'identification</button>'
        + '</div>'
        + '<div class="af-reponse" id="afReponse" role="status" aria-live="polite"></div>'
        + pupitre({sansJauge:true})
        + '</div>');

      var video = hote.querySelector('#afCam');
      var placeholder = hote.querySelector('#afCamPlaceholder');
      var reponse = hote.querySelector('#afReponse');
      var manuel = hote.querySelector('#afManuel');

      function dire(html, kind) {
        reponse.innerHTML = html;
        reponse.className = 'af-reponse' + (kind ? ' is-' + kind : '');
      }

      hote.querySelector('#afCamBtn').addEventListener('click', function () {
        var btn = this;
        btn.disabled = true;
        dire('📷 Autorise l’accès à la caméra, puis vise le code-barres au dos de l’ouvrage.', '');
        demarrerLecteur(video, function (code) {
          dire('🔎 Code lu — le hublot examine l’ouvrage…', '');
          proposer(code);
        }, function (motif) {
          btn.disabled = false;
          dire(motif === 'autorisation-refusee'
            ? '🚫 Accès caméra refusé. Utilise « Saisir les chiffres » : le hublot accepte aussi la saisie manuelle.'
            : '⚠️ Caméra indisponible sur cet appareil. Utilise « Saisir les chiffres ».', 'warn');
        }).then(function (lecteur) {
          etat.lecteur = lecteur;
          if (lecteur.moteur === 'manuel') {
            placeholder.hidden = false;
            btn.disabled = false;
            manuel.hidden = false;
            dire('📵 Lecteur automatique indisponible : saisis les 13 chiffres imprimés sous le code-barres.', 'warn');
          } else {
            video.hidden = false;
            placeholder.hidden = true;
            btn.textContent = '📸 Caméra active';
          }
        });
      });

      hote.querySelector('#afManuelBtn').addEventListener('click', function () {
        manuel.hidden = !manuel.hidden;
        if (!manuel.hidden) hote.querySelector('#afEan').focus();
      });

      hote.querySelector('#afEanOk').addEventListener('click', function () {
        proposer(hote.querySelector('#afEan').value);
      });
      hote.querySelector('#afEan').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') proposer(this.value);
      });
      brancherPupitre();

      function proposer(code) {
        var normalise = M.eanNormalise(code);
        if (!normalise || !M.eanValide(normalise)) {
          /* Code invalide : le hublot ne l'examine même pas → AUCUNE
             erreur comptée. Un scan à moitié lu ne doit jamais coûter
             une tentative au matelot. */
          dire('⚠️ ' + lignes(M.MESSAGES.eanInvalide), 'warn');
          return;
        }
        dire('🔏 Le hublot examine l’ouvrage…', '');
        service.verifierEtape(etat.session.equipe, 'sceau', normalise, { matelotKey: (o.matelot && o.matelot.memberKey) || '' }).then(function (r) {
          majSession(r);
          if (r.ok) {
            journal('🔏 <b>Le hublot reconnait l\'ouvrage.</b> L’artefact du Nautilus est authentifié.', 'success');
            dire('✅ ' + lignes(M.MESSAGES.scanAccepte), 'ok');
            setTimeout(function () { etapeSuivante(); }, 1600);
            return;
          }
          if (r.erreur) {
            journal('🔍 Le hublot a rejete un ouvrage (' + r.erreurs + '/' + r.maxErreurs + ').', 'warning');
            dire('❌ ' + lignes(r.motif) + (r.dernierAvertissement ? '<br><b>' + lignes(r.dernierAvertissement) + '</b>' : ''), 'danger');
            majErreurs(r);
          } else {
            dire('⚠️ ' + lignes(r.motif), 'warn');
          }
        }).catch(function (e) {
          dire('⚠️ Vérification impossible (' + lignes(String(e && e.message || e)) + '). Réessaie, ou préviens le capitaine.', 'warn');
        });
      }
    }

    /* --- écran : une étape de réponse saisie ----------------------- */
    function vueEtape(etape) {
      etat.vue = etape.id;
      var grille = etape.id === 'signature'
        ? '<div class="af-grille"><b>Table du Nautilus — pour coder les lettres en nombres</b>'
          + '<span>A=01 B=02 C=03 D=04 E=05 F=06 G=07 H=08 I=09 J=10 K=11 L=12 M=13</span>'
          + '<span>N=14 O=15 P=16 Q=17 R=18 S=19 T=20 U=21 V=22 W=23 X=24 Y=25 Z=26</span>'
          + '<span>Ex : C → 03. Écris chaque nombre sur 2 chiffres (6 → 06) et sépare les fragments par un tiret.</span>'
          + '</div>'
        : '';
      rendre('<div class="af-carte">'
        + jaugeHtml()
        + '<p class="af-kicker">Journal de bord — ' + echapper(etape.libelle) + '</p>'
        + '<h3 class="af-titre">📜 ' + echapper(etape.libelle) + '</h3>'
        + '<blockquote class="af-enigme">' + lignes(etape.consigne) + '</blockquote>'
        + grille
        + '<div class="af-saisie">'
        +   '<label for="afReponseChamp">Ta réponse</label>'
        +   '<input id="afReponseChamp" type="text" autocomplete="off" autocapitalize="characters" '
        +     'spellcheck="false" placeholder="' + echapper(etape.format || '…') + '">'
        +   '<button type="button" class="af-btn af-btn--or" id="afValider">⚓ Sceller cette réponse</button>'
        + '</div>'
        + '<div class="af-reponse" id="afReponse" role="status" aria-live="polite"></div>'
        + pupitre({sansJauge:true})
        + '</div>');

      var champ = hote.querySelector('#afReponseChamp');
      var reponse = hote.querySelector('#afReponse');
      function dire(html, kind) {
        reponse.innerHTML = html;
        reponse.className = 'af-reponse' + (kind ? ' is-' + kind : '');
      }
      champ.focus();
      function valider() {
        var valeur = champ.value;
        if (!valeur.trim()) { dire('⚠️ Saisis une réponse avant de sceller.', 'warn'); return; }
        champ.disabled = true;
        dire('🔎 Le Nautilus vérifie…', '');
        service.verifierEtape(etat.session.equipe, etape.id, valeur, { matelotKey: (o.matelot && o.matelot.memberKey) || '' }).then(function (r) {
          majSession(r);
          champ.disabled = false;
          if (r.ok) {
            journal('📜 Étape « ' + echapper(etape.libelle) + ' » validée.', 'success');
            dire('✅ ' + lignes(r.message), 'ok');
            setTimeout(function () { r.fini ? terminer() : etapeSuivante(); }, 1300);
            return;
          }
          if (r.erreur) {
            journal('❌ Réponse refusée à « ' + echapper(etape.libelle) + ' » (' + r.erreurs + '/' + r.maxErreurs + ').', 'warning');
            dire('❌ <b>Le Nautilus refuse cette réponse.</b>'
              + (r.dernierAvertissement ? '<br>' + lignes(r.dernierAvertissement) : '')
              + (r.remontee ? '' : '<br>Relis la consigne : la forme est libre, le fond ne l’est pas.'), 'danger');
            majErreurs(r);
          } else {
            dire('⚠️ ' + lignes(r.motif), 'warn');
          }
        }).catch(function (e) {
          champ.disabled = false;
          dire('⚠️ Vérification impossible (' + lignes(String(e && e.message || e)) + ').', 'warn');
        });
      }
      hote.querySelector('#afValider').addEventListener('click', valider);
      champ.addEventListener('keydown', function (e) { if (e.key === 'Enter') valider(); });
      brancherPupitre();
    }

    /* Le service est la source de vérité : après chaque vérification, la
       copie locale de la session est remise à jour. Sans cela, l'écran
       suivant serait recalculé sur une progression périmée (et le hublot
       validé ferait revenir au hublot). */
    function majSession(r) {
      if (!r || !etat.session) return;
      if (Array.isArray(r.etapesValidees)) {
        etat.session.etapesValidees = r.etapesValidees;
        etat.session.etape = r.etapesValidees.length;
      }
      if (typeof r.erreurs === 'number') {
        // si on a une carte perso, on la met à jour aussi (sinon l'affichage repasserait à 0 au prochain chargement)
        var _mk2 = (o.matelot && o.matelot.memberKey) || '';
        if (_mk2 && etat.session.erreursParMatelot) {
          // le serveur a déjà resetté à 0 en cas de remontée, on reflète la valeur retournée
          // sauf si remontée (r.remontee) : le serveur stocke 0 mais on affiche le max pour l'animation
          if (r.remontee) etat.session.erreursParMatelot[_mk2] = 0;
          else etat.session.erreursParMatelot[_mk2] = r.erreurs;
        }
        etat.session.erreurs = r.erreurs;
      }
      if (r.fini) etat.session.statut = 'terminee';
    }

    function majErreurs(r) {
      majSession(r);
      etat.erreurs = Number(r.erreurs || 0);
      if (typeof onErreurComptee === 'function') onErreurComptee(etat.erreurs, r.maxErreurs);
      if (r.remontee) {
        arreterLecteur();
        onRemontee({ motif: 'echec', erreurs: etat.erreurs, maxErreurs: r.maxErreurs });
        return;
      }
      // Mise à jour ultra-visible : recréation complète avec états warning/critical + animation
      var pup = hote && hote.querySelector('.af-pupitre');
      if (pup) {
        var max = r.maxErreurs || M.MAX_ERREURS;
        var perdues = Math.max(0, max - Math.max(0, max - etat.erreurs));
        var restantes = Math.max(0, max - etat.erreurs);
        var jauge = pup.querySelector('.af-jauge');
        if (jauge) {
          jauge.classList.remove('is-warning', 'is-critical');
          if (restantes === 0) jauge.classList.add('is-critical');
          else if (restantes === 1) jauge.classList.add('is-warning');
          var cnt = jauge.querySelector('.af-jauge-count');
          if (cnt) cnt.textContent = restantes + ' / ' + max;
        }
        var pts = pup.querySelectorAll('.af-jauge-pt');
        Array.prototype.forEach.call(pts, function (p, i) {
          var doitEtrePerdu = i < perdues;
          var etaitPerdu = p.classList.contains('is-lost') || p.classList.contains('is-grille');
          p.classList.toggle('is-lost', doitEtrePerdu);
          p.classList.toggle('is-grille', doitEtrePerdu);
          if (doitEtrePerdu && !etaitPerdu) {
            p.classList.add('is-just-lost');
            setTimeout(function(){ p.classList.remove('is-just-lost'); }, 600);
          }
        });
      }
    }

    /* --- « Livre introuvable » : aucune erreur, signalement --------- */
    function vueIntrouvable() {
      rendre('<div class="af-carte af-carte--scellee">'
        + '<p class="af-kicker">Signalement au capitaine</p>'
        + '<h3 class="af-titre">📵 ' + lignes(M.MESSAGES.introuvable) + '</h3>'
        + '<p class="af-msg">Ce signalement <b>n’ajoute aucune erreur</b> à ton équipage : il prévient le capitaine, '
        + 'qui vérifie la piste et peut affecter un autre ouvrage.</p>'
        + '<div class="af-actions">'
        +   '<button type="button" class="af-btn af-btn--or" id="afSignaler">📡 Prévenir le capitaine</button>'
        +   '<button type="button" class="af-btn af-btn--ghost" id="afRetour">↩ Reprendre la recherche</button>'
        + '</div>'
        + '<div class="af-reponse" id="afReponse" role="status"></div>'
        + '</div>');
      hote.querySelector('#afRetour').addEventListener('click', reprendre);
      hote.querySelector('#afSignaler').addEventListener('click', function () {
        var btn = this;
        btn.disabled = true;
        service.signalerIntrouvable(etat.session.equipe, { par: o.matelot && o.matelot.name })
          .then(function (r) {
            journal('📡 <b>Ouvrage signalé introuvable</b> — le capitaine vérifie la piste (aucune erreur comptée).', 'warning');
            signalerCapitaine('Ouvrage signalé introuvable au magasin '
              + (etat.magasin ? etat.magasin.nom || etat.magasin.id : '?') + '.');
            hote.querySelector('#afReponse').innerHTML = '✅ ' + lignes(r.message);
            hote.querySelector('#afReponse').className = 'af-reponse is-ok';
            setTimeout(function () { vueSuspendue(etat.session); }, 2200);
          })
          .catch(function (e) {
            btn.disabled = false;
            hote.querySelector('#afReponse').innerHTML = '⚠️ Signalement non transmis ('
              + lignes(String(e && e.message || e)) + '). Réessaie.';
            hote.querySelector('#afReponse').className = 'af-reponse is-warn';
          });
      });
    }

    /* --- indice payant : le sacrifice, puis l'indice --------------- */
    function proposerSacrifice(rang) {
      var indice = null;
      for (var i = 0; i < M.INDICES.length; i++) if (M.INDICES[i].rang === rang) indice = M.INDICES[i];
      if (!indice) return;
      rendre('<div class="af-carte af-carte--sacrifice">'
        + '<p class="af-kicker">Sacrifice volontaire</p>'
        + '<h3 class="af-titre">🕯️ Indice « ' + echapper(indice.titre) + ' »</h3>'
        + '<p class="af-msg">' + lignes(M.MESSAGES.sacrificePropose.replace('{duree}', indice.heures + ' heure'
          + (indice.heures > 1 ? 's' : ''))) + '</p>'
        + '<p class="af-msg af-msg--petit">Un indice n’est pas une faute : il reste acquis à <b>ton équipage</b>. '
        + 'Mais il te coûte ta place à bord pendant ' + indice.heures + ' h, et un autre membre de l’équipage '
        + 'prendra le relais.</p>'
        + '<div class="af-actions">'
        +   '<button type="button" class="af-btn af-btn--danger" id="afSacrificeOui">⚓ Accepter le sacrifice</button>'
        +   '<button type="button" class="af-btn af-btn--ghost" id="afSacrificeNon">↩ Poursuivre sans indice</button>'
        + '</div>'
        + '<div class="af-reponse" id="afReponse" role="status"></div>'
        + '</div>');
      hote.querySelector('#afSacrificeNon').addEventListener('click', function () {
        journal('🕯️ Sacrifice refusé : le matelot poursuit sans indice.', 'info');
        reprendre();
      });
      hote.querySelector('#afSacrificeOui').addEventListener('click', function () {
        var btn = this;
        btn.disabled = true;
        var reponse = hote.querySelector('#afReponse');
        reponse.innerHTML = '🌊 Le Nautilus accepte ton sacrifice…';
        reponse.className = 'af-reponse';
        /* L'ordre compte : la demande est INSCRITE d'abord (l'indice est
           acquis à l'équipage), puis le blocage personnel est posé. */
        service.demanderIndice(etat.session.equipe, rang, { par: o.matelot && o.matelot.name })
          .then(function (r) {
            if (!r.ok) {
              reponse.innerHTML = '⚠️ ' + lignes(r.motif || 'indice indisponible')
                + (r.texte ? '<br><b>' + lignes(r.texte) + '</b>' : '');
              reponse.className = 'af-reponse is-warn';
              return;
            }
            etat.indices = (etat.session.indicesUtilises || []).concat([indice.cle]);
            etat.session.indicesUtilises = etat.indices;
            if (r.aide) {
              etat.session.indicesTransmis = Object.assign({}, etat.session.indicesTransmis || {});
            }
            journal('🕯️ <b>Sacrifice accepté</b> : indice « ' + echapper(indice.titre) + ' » ('
              + indice.heures + ' h en surface). L’indice reste acquis à l’équipage.', 'warning');
            reponse.innerHTML = '✅ ' + lignes(M.MESSAGES.sacrificeAccepte)
              + '<div class="af-indice-transmis">' + lignes(r.aide) + '</div>'
              + '<p class="af-msg af-msg--petit">L’indice exact (valeur précise) est transmis par le capitaine '
              + 'depuis le panneau admin — il s’affiche ici dès qu’il l’a envoyé.</p>';
            reponse.className = 'af-reponse is-ok';
            /* La remontée est appliquée par la page (matelot-blocages.js) :
               c'est elle qui connaît le barème et l'identité du matelot. */
            return Promise.resolve(onSacrifice(indice, r.aide)).then(function (blo) {
              onRemontee({ motif: 'indice', indice: indice, heures: (blo && blo.heures) || indice.heures,
                           lockedUntil: blo && blo.lockedUntil });
            });
          })
          .catch(function (e) {
            btn.disabled = false;
            reponse.innerHTML = '⚠️ Sacrifice non enregistré (' + lignes(String(e && e.message || e))
              + '). Aucune remontée n’a été appliquée.';
            reponse.className = 'af-reponse is-warn';
          });
      });
    }

    /* --- navigation dans les étapes -------------------------------- */
    function etapes() {
      return (etat.session && etat.session.cartouche && etat.session.cartouche.etapes) || [];
    }
    function prochaineEtape() {
      var validees = (etat.session && etat.session.etapesValidees) || [];
      var l = etapes();
      for (var i = 0; i < l.length; i++) if (validees.indexOf(l[i].id) < 0) return l[i];
      return null;
    }
    function etapeSuivante() {
      var e = prochaineEtape();
      if (!e) { terminer(); return; }
      if (e.id === 'sceau') vueSceau();
      else vueEtape(e);
    }
    function reprendre() {
      var validees = (etat.session && etat.session.etapesValidees) || [];
      if (!validees.length) { vueIndice(); return; }
      /* Le hublot est franchi : on enchaîne sur les épreuves de l'ouvrage. */
      etapeSuivante();
    }

    function terminer() {
      arreterLecteur();
      var temps = Math.max(0, Math.round((Date.now() - etat.t0) / 1000));
      onVictoire({ tempsSecondes: temps, erreurs: etat.erreurs, indices: etat.indices,
                   session: etat.session });
    }

    /* --- chargement : magasin → session → vue --------------------- */
    function charger() {
      if (!service) {
        rendre('<p class="af-msg danger">Service de l’artefact absent.</p>');
        return Promise.resolve();
      }
      if (!etat.magasin || !etat.magasin.id) {
        if (magasins && magasins.courant && magasins.courant()) etat.magasin = magasins.courant();
      }
      if (!etat.magasin || !etat.magasin.id) { vueMagasin(); return Promise.resolve(); }
      // Garde magasin d'origine : hors zone (>500 m ou changement de magasin) = accès refusé au palier
      var Gc = window.NautilusMagasinGuard;
      if(Gc && Gc.verifierAcces){
        etat.vue = 'chargement';
        rendre('<div class="af-carte"><p class="af-kicker">Salle des machines</p><h3 class="af-titre">📍 Vérification du magasin…</h3><p class="af-msg">Contrôle de la distance au magasin d’origine.</p></div>');
        return Gc.verifierAcces({ magasin: etat.magasin }).then(function(info){
          if(etat.detruit) return;
          if(!info.autorise){
            rendre(Gc.messageHTML(info));
            var b=hote.querySelector('#afGuardRetry'); if(b) b.addEventListener('click', charger);
            return;
          }
          etat.vue = 'chargement';
          rendre('<div class="af-carte"><p class="af-kicker">Salle des machines</p>'
            + '<h3 class="af-titre">🌊 Préparation de ta mission…</h3>'
            + '<p class="af-msg">Vérification en cours au magasin <b>'
            + echapper(etat.magasin.nom || etat.magasin.id) + '</b>.</p></div>');
          return service.ouvrirSession(o.equipe, etat.magasin.id).then(suiteCharger).catch(errCharger);
        }).catch(function(){ return lancerOuvrirSession(); });
        function suiteCharger(r){ if(etat.detruit) return; if(r.erreur === 'magasin-requis'){ vueMagasin(); return; } if(r.erreur === 'aucun-ouvrage'){ journal('⛔ Aucun ouvrage compatible confirmé pour ce magasin.', 'warning'); vueAucunOuvrage('Aucun ouvrage ici. Préviens le capitaine.', ''); return; } if(r.erreur){ vueAucunOuvrage(r.message || M.MESSAGES.aucunOuvrage, ''); return; } etat.session = r.session; (function(){ var _mk = (o.matelot && o.matelot.memberKey) || ''; var _map = r.session.erreursParMatelot || {}; etat.erreurs = _mk && _map[_mk] != null ? Number(_map[_mk]||0) : Number(r.session.erreurs || 0); })(); etat.indices = r.session.indicesUtilises || []; if(r.session.statut === 'suspendue'){ vueSuspendue(r.session); return; } if(r.session.statut === 'terminee'){ terminer(); return; } if(r.session.remplacement){ journal('🔁 Piste remplacée par le capitaine : ' + lignes(M.MESSAGES.replacement), 'info'); } if(r.reprise && (r.session.etapesValidees || []).length){ journal('⚓ Mission reprise là où l’équipage s’était arrêté.', 'info'); } var validees2 = r.session.etapesValidees || []; if(!validees2.length) vueIndice(); else etapeSuivante(); }
        function errCharger(e){ if(etat.detruit) return; vueAucunOuvrage('Le Nautilus ne parvient pas à joindre son journal de bord.', 'Vérifie la connexion, puis relance. (' + M.nettoyerTexte(e && e.message, 120) + ')'); }
        function lancerOuvrirSession(){ etat.vue = 'chargement'; rendre('<div class="af-carte"><p class="af-kicker">Salle des machines</p><h3 class="af-titre">🌊 Préparation de ta mission…</h3><p class="af-msg">Vérification en cours au magasin <b>'+echapper(etat.magasin.nom || etat.magasin.id)+'</b>.</p></div>'); return service.ouvrirSession(o.equipe, etat.magasin.id).then(suiteCharger).catch(errCharger); }
      }
      etat.vue = 'chargement';
      rendre('<div class="af-carte"><p class="af-kicker">Salle des machines</p>'
        + '<h3 class="af-titre">🌊 Préparation de ta mission…</h3>'
        + '<p class="af-msg">Vérification en cours au magasin <b>'
        + echapper(etat.magasin.nom || etat.magasin.id) + '</b>.</p></div>');

      return service.ouvrirSession(o.equipe, etat.magasin.id).then(function (r) {
        if (etat.detruit) return;
        if (r.erreur === 'magasin-requis') { vueMagasin(); return; }
        if (r.erreur === 'aucun-ouvrage') {
          journal('⛔ Aucun ouvrage compatible confirmé pour ce magasin.', 'warning');
          vueAucunOuvrage('Aucun ouvrage ici. Préviens le capitaine.', '');
          return;
        }
        if (r.erreur) {
          vueAucunOuvrage(r.message || M.MESSAGES.aucunOuvrage, '');
          return;
        }
        etat.session = r.session;
        (function(){
          var _mk = (o.matelot && o.matelot.memberKey) || '';
          var _map = r.session.erreursParMatelot || {};
          etat.erreurs = _mk && _map[_mk] != null ? Number(_map[_mk]||0) : Number(r.session.erreurs || 0);
        })();
        etat.indices = r.session.indicesUtilises || [];
        if (r.session.statut === 'suspendue') { vueSuspendue(r.session); return; }
        if (r.session.statut === 'terminee') { terminer(); return; }
        if (r.session.remplacement) {
          journal('🔁 Piste remplacée par le capitaine : ' + lignes(M.MESSAGES.replacement), 'info');
        }
        if (r.reprise && (r.session.etapesValidees || []).length) {
          journal('⚓ Mission reprise là où l’équipage s’était arrêté.', 'info');
        }
        var validees = r.session.etapesValidees || [];
        if (!validees.length) vueIndice();
        else etapeSuivante();
      }).catch(function (e) {
        if (etat.detruit) return;
        vueAucunOuvrage('Le Nautilus ne parvient pas à joindre son journal de bord.',
          'Vérifie la connexion, puis relance. (' + M.nettoyerTexte(e && e.message, 120) + ')');
      });
    }

    return {
      charger: charger,
      reprendre: reprendre,
      detruire: function () { etat.detruit = true; arreterLecteur(); if (hote) hote.innerHTML = ''; },
      etat: function () { return { vue: etat.vue, erreurs: etat.erreurs, session: etat.session }; }
    };
  }

  window.NautilusArtefactJeu = {
    init: init,
    demarrerLecteur: demarrerLecteur,
    detecteurNatifDisponible: detecteurNatifDisponible,
    URL_ZXING: URL_ZXING
  };
})();
