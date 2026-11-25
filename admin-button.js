/* ============================================================================
   Accès admin commun aux pages Mission Nautilus.
   ----------------------------------------------------------------------------
   Sur la page d'accueil (index.html), le panneau admin est déjà intégré : ce
   module se contente de déclencher son engrenage (raccourci ?admin=1).

   Sur TOUTES les autres pages, ce module INJECTE le panneau admin intégré
   (HTML + CSS + logique) directement dans la page courante et l'ouvre en
   modale fixe au-dessus de tout (z-index 12000) — sans iframe ni redirection.
   Le panneau s'affiche donc sur la page où l'on se trouve, comme sur index.html.
============================================================================ */

  import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
  import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
  import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

  const firebaseConfig = {
    apiKey: "AIzaSyB5ivqXO1W9fZqqhwJ0uDnLgVgvWSfQz50",
    authDomain: "mission-nautilus.firebaseapp.com",
    projectId: "mission-nautilus",
    storageBucket: "mission-nautilus.firebasestorage.app",
    messagingSenderId: "444670686419",
    appId: "1:444670686419:web:00d186940a2fb8c8c29026"
  };
  /* Les pages Palier et Classement initialisent déjà Firebase dans leur
     module principal. Réutiliser l'application par défaut évite l'exception
     "Firebase App named '[DEFAULT]' already exists", qui interrompait le
     script AVANT l'injection et l'ouverture de la modale. */
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  /* La page Classement n'initialise pas elle-même l'authentification. Sans
     cette session anonyme, le panneau est visible mais ses actions d'écriture
     sont refusées par les règles Firestore sur les pages hors accueil. */
  const authReady = signInAnonymously(auth)
    .catch(error => console.warn('Firebase Auth anonyme indisponible:', error));
  const db = getFirestore(app);

  window.NautilusAdminDb = {
    db: db,
    doc: doc,
    getDoc: getDoc,
    setDoc: setDoc,
    updateDoc: updateDoc,
    deleteDoc: deleteDoc,
    deleteField: deleteField,
    collection: collection,
    getDocs: getDocs,
    serverTimestamp: serverTimestamp,
    getTeamDoc: (code) => getDoc(doc(db, 'teams', code))
  };

  function ensureAdminModules(){
    function loadScript(src, id){
      if(document.getElementById(id) || document.querySelector('script[src*="' + src.split('?')[0] + '"]')) return;
      const s = document.createElement('script');
      s.id = id;
      s.src = src;
      s.defer = true;
      document.body.appendChild(s);
    }
    if(!window.NautilusArtefactMoteur) loadScript('artefact-moteur.js?v=8', 'scriptArtefactMoteur');
    if(!window.NautilusArtefact) loadScript('artefact-service.js?v=8', 'scriptArtefactService');
    if(!window.NautilusMagasin) loadScript('magasin-fnac.js?v=3', 'scriptMagasinFnac');
    if(!window.FnacLecteur) loadScript('fnac-lecteur.js?v=1', 'scriptFnacLecteur');
    if(!window.NautilusPhotoDefi) loadScript('photo-defi.js?v=4', 'scriptPhotoDefi');
    if(!window.NautilusBataille) loadScript('palier4-bataille.js?v=3', 'scriptPalier4Bataille');
    if(!window.NautilusQuiz) loadScript('quiz-palier6.js?v=3', 'scriptQuizPalier6');
    if(!window.NautilusAdminArtefact) loadScript('admin-artefact.js?v=33', 'scriptAdminArtefact');
  }



  /* Filet de sécurité : le panneau reste une vraie modale même si la feuille
     CSS externe arrive en retard, est absente du cache PWA ou est bloquée.
     Les styles complets restent dans css/admin.css. */
  const ADMIN_MODAL_FALLBACK_CSS = `
    #adminPanel.nautilus-admin-modal{
      position:fixed !important; inset:0 !important; z-index:12000 !important;
      display:none !important; flex-direction:column; align-items:center;
      justify-content:center; margin:0 !important; padding:clamp(10px,2vw,24px);
      overflow:hidden; border:0; border-radius:0 !important;
      background:rgba(2,8,18,.82); box-sizing:border-box;
    }
    #adminPanel.nautilus-admin-modal.open{display:flex !important}
    #adminPanel.nautilus-admin-modal > h2{
      width:100%; max-width:900px; margin:0; padding:13px 16px; padding-right:52px !important;
      position:relative !important; display:flex; align-items:center; gap:10px;
      color:#ffb4ad; background:linear-gradient(90deg,#3a0a08,#7a1812);
      border:1px solid rgba(245,176,39,.5); border-bottom:0;
      border-radius:16px 16px 0 0; box-sizing:border-box;
    }
    #adminCloseBtn{
      position:absolute !important; top:50% !important; transform:translateY(-50%) !important; right:14px !important;
      width:32px !important; height:32px !important; min-height:32px !important;
      border-radius:50% !important; z-index:10 !important;
    }
    #adminPanel.nautilus-admin-modal > .body{
      width:100%; max-width:900px; max-height:calc(100dvh - 150px);
      overflow-y:auto; padding:14px 16px; box-sizing:border-box;
      color:#eaf8ff; background:linear-gradient(180deg,#071a2b 0%,#03111f 100%);
      border:1px solid rgba(245,176,39,.5); border-top:0;
      border-radius:0 0 16px 16px;
    }
  `;

  function ensureAdminModalFallbackStyles(){
    if(document.getElementById('nautilusAdminModalFallbackCss')) return;
    const style = document.createElement('style');
    style.id = 'nautilusAdminModalFallbackCss';
    style.textContent = ADMIN_MODAL_FALLBACK_CSS;
    document.head.appendChild(style);
  }

  const ADMIN_PANEL_HTML = '<section class="card" id="adminPanel" role="dialog" aria-modal="true" aria-label="Panneau admin" style="display:none">\n    <h2 style="background:linear-gradient(90deg,#3a0a08,#7a1812);color:#ffb4ad;position:relative;display:flex;align-items:center;gap:12px;padding-right:52px">\n      <span>⚙️ PANNEAU ADMIN — ACCÈS RESTREINT</span>\n      <button id="adminCloseBtn" type="button" aria-label="Fermer le panneau" title="Fermer" style="position:absolute;top:50%;transform:translateY(-50%);right:14px;background:rgba(255,75,62,.22);color:#ffb4ad;border:1px solid rgba(255,75,62,.48);border-radius:50%;width:32px;height:32px;min-height:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;margin:0;font-size:18px;line-height:1;font-weight:900;flex:0 0 auto;transition:.18s background,.18s color,.18s transform">\n        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>\n      </button>\n    </h2>\n    <div class="body">\n      <p class="small" style="color:#ff8579;font-weight:900;letter-spacing:.04em">🔒 Ce panneau est réservé à l\'équipe d\'organisation. Accès par code uniquement.</p>\n      <div class="hr"></div>\n      <div id="adminLocked" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">\n        <div style="flex:1;min-width:220px"><label for="adminCodeInput">Code d\'accès admin</label><input id="adminCodeInput" type="text" placeholder="••••••••" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-form-type="other" name="nautilus_admin_code_xyz" data-lpignore="true" data-1p-ignore="true" inputmode="text" aria-label="Code d\'accès admin" style="text-transform:none;letter-spacing:.15em;font-family:Consolas,monospace"></div>\n        <span id="adminUnlockMsg" class="small" style="width:100%"></span>\n      </div>\n      <div id="adminWorkspace" style="display:none">\n        <div class="row" style="justify-content:flex-end;align-items:center;margin-bottom:10px">\n          <span class="small" style="color:#5be09b;font-weight:900">✅ Session admin active</span>\n        </div>\n\n        <div class="admin-designer-box" style="margin:0 0 12px;padding:12px;border:1px solid rgba(142,231,255,.35);border-radius:10px;background:rgba(8,30,48,.85);color:#eaf8ff">\n          <div style="font-weight:900;color:#8ee7ff;margin-bottom:4px">🧪 ACCÈS CONCEPTEUR</div>\n          <div class="small" style="margin-bottom:9px">Ouvre chaque page du jeu dans un onglet isolé : l’aperçu organisateur n’écrit <b>aucun blocage ni aucune progression réelle</b>. Pour tester tes QR Codes imprimés : ouvre la « page scellée » du palier et vise le code.</div>\n          <button class="secondary" id="adminDesignerBtn" type="button" style="margin:0">🧪 Tester toutes les pages</button>\n          <div id="adminDesignerBox" style="display:none;margin-top:10px"></div>\n        </div>\n\n        <div class="admin-tabs" role="tablist">\n          <button class="admin-tab active" data-tab="members" type="button" role="tab"><span class="lbl-desktop">👥 Inscriptions</span><span class="lbl-mobile" aria-label="Inscriptions">👥</span></button>\n          <button class="admin-tab" data-tab="teams" type="button" role="tab"><span class="lbl-desktop">🚢 Équipes</span><span class="lbl-mobile" aria-label="Équipes">🚢</span></button>\n          <button class="admin-tab" data-tab="locks" type="button" role="tab"><span class="lbl-desktop">🔒 Blocages</span><span class="lbl-mobile" aria-label="Blocages">🔒</span></button>\n          <button class="admin-tab" data-tab="oxygen" type="button" role="tab"><span class="lbl-desktop">⏱️ O₂</span><span class="lbl-mobile" aria-label="O₂">⏱️</span></button>\n          <button class="admin-tab" data-tab="danger" type="button" role="tab"><span class="lbl-desktop">⚠️ Danger</span><span class="lbl-mobile" aria-label="Danger">⚠️</span></button>\n        </div>\n\n        <!-- TAB: MEMBRES -->\n        <div class="admin-pane" data-pane="members">\n          <div class="row" style="margin-bottom:10px;align-items:center">\n            <span class="small" style="flex:1">Inscris un matelot, modifie son nom, son service ou son équipage, ou supprime-le.</span>\n            <button class="secondary" id="adminReloadBtn" type="button" style="margin:0;padding:6px 12px;font-size:12px">↻ Recharger</button>\n          </div>\n          <div class="admin-add-member">\n            <div class="admin-add-title">➕ Inscrire un matelot</div>\n            <div class="admin-form-grid">\n              <label for="adminNewMemberName">Nom</label>\n              <input id="adminNewMemberName" type="text" maxlength="32" placeholder="Ex. JULES VERNE" autocomplete="off">\n              <label for="adminNewMemberSvc">Service</label>\n              <select id="adminNewMemberSvc"><option value="" selected disabled>Ex. PE</option></select>\n              <label for="adminNewMemberTeam">Équipage</label>\n              <select id="adminNewMemberTeam"><option value="" selected disabled>Choisir…</option></select>\n            </div>\n            <div class="admin-actions-row">\n              <button class="primary" id="adminAddMemberBtn" type="button">➕ Inscrire le matelot</button>\n            </div>\n            <div id="adminAddMemberMsg"></div>\n          </div>\n          <div id="adminMembersBox" class="teamlist"></div>\n        </div>\n\n        <!-- TAB: BLOCAGES -->\n        <div class="admin-pane" data-pane="locks" style="display:none">\n          <p class="small" style="margin-bottom:10px">Pour chaque équipe : activer/désactiver le blocage, ou modifier la date/heure de reprise autorisée.</p>\n          <div id="adminLocksBox" class="teamlist"></div>\n        </div>\n\n        <!-- TAB: O2 -->\n        <div class="admin-pane" data-pane="oxygen" style="display:none">\n          <p class="small" style="margin-bottom:10px">Le compte à rebours de la réserve O₂ (durée de la mission) peut être réinitialisé, ou décalé en modifiant la date/heure de départ.</p>\n          <div class="admin-o2-status">\n            <div class="admin-o2-row"><span>État actuel</span><strong id="adminO2Now">—</strong></div>\n            <div class="admin-o2-row"><span>Statut</span><span class="admin-o2-badge" id="adminO2State">—</span></div>\n            <div class="admin-o2-row"><span>Temps restant</span><strong id="adminO2Countdown">—</strong></div>\n          </div>\n          <div class="admin-form-grid admin-o2-form">\n            <label for="adminO2Days">Durée (jours)</label>\n            <input id="adminO2Days" type="number" min="0" step="1" value="7">\n            <label for="adminO2Hours">Durée (heures)</label>\n            <input id="adminO2Hours" type="number" min="0" max="23" step="1" value="0">\n          </div>\n          <div class="admin-actions-row">\n            <button class="primary" id="adminO2Apply" type="button">💾 Appliquer la modification</button>\n            <button class="secondary" id="adminO2Reset" type="button">♻️ Reset à maintenant (durée initiale)</button>\n            <button class="danger" id="adminO2Clear" type="button">🛑 Arrêter la mission</button>\n          </div>\n        </div>\n\n        <!-- TAB: EQUIPES -->\n        <div class="admin-pane" data-pane="teams" style="display:none">\n          <p class="small" style="margin-bottom:10px">Ajoute, renomme ou supprime une équipe. La suppression purge le doc Firestore correspondant et l\'ajoute à la liste des codes obsolètes (nettoyés à chaque init).</p>\n          <div id="adminTeamsBox" class="teamlist"></div>\n          <div class="hr"></div>\n          <div class="row" style="gap:10px;align-items:flex-end;flex-wrap:wrap">\n            <div style="flex:1;min-width:220px"><label for="adminNewTeamName">Nom de la nouvelle équipe</label><input id="adminNewTeamName" placeholder="Ex. Moby Dick" maxlength="24" autocomplete="off"></div>\n            <button class="primary" id="adminAddTeamBtn" type="button" style="margin:0">➕ Ajouter</button>\n          </div>\n        </div>\n\n        <!-- TAB: DANGER -->\n        <div class="admin-pane" data-pane="danger" style="display:none">\n          <p style="margin:0 0 12px;font-weight:900;color:#ff8579">⚠️ Zone sensible — actions irréversibles</p>\n          <div style="display:flex;gap:10px;flex-wrap:wrap">\n            <button class="danger" id="resetAllMembersBtn" type="button" style="margin:0">🗑️ Reset des membres (toutes équipes)</button>\n            <button class="danger" id="resetAllProgressBtn" type="button" style="margin:0;background:rgba(255,75,62,.2);color:#ff8579;border:1px solid rgba(255,75,62,.5)">🔄 Reset progression (toutes équipes)</button>\n            <button class="secondary" id="cleanupTestSessionsBtn" type="button" style="margin:0">🧪 Purger les traces du compte test</button>\n            <button class="secondary" id="adminPurgePwaBtn" type="button" style="margin:0;background:rgba(255,211,108,.2);color:#ffd36c;border:1px solid rgba(255,211,108,.5)">🔄 Vider le cache PWA</button>\n          </div>\n          <p class="small" style="margin-top:12px"><b>Reset des membres</b> : vide la liste des matelots inscrits de tous les équipages sans toucher à la progression de la mission.<br><b>Reset progression</b> : remet toutes les équipes au Palier 1 avec scores et blocages réinitialisés.<br><b>Purger le compte test</b> : retire toute trace du compte de test ZZZZ-0000 (blocages, parties ou présence TEST).<br><b>Vider le cache PWA</b> : supprime les caches du Service Worker et force le rechargement immédiat de la toute dernière version des pages.</p>\n        </div>\n      </div>\n    </div>\n  </section>';
  function injectAdminPanel(){
    ensureAdminModalFallbackStyles();
    if(!document.getElementById('nautilusAdminCss')){
      const link = document.createElement('link');
      link.id = 'nautilusAdminCss';
      link.rel = 'stylesheet';
      // Versionné pour ne jamais réutiliser l'ancienne feuille corrompue du
      // cache PWA sur les pages palier et classement.
      link.href = 'css/admin.css?v=13';
      document.head.appendChild(link);
    }
    if(!document.getElementById('nautilusArtefactCss')){
      const linkA = document.createElement('link');
      linkA.id = 'nautilusArtefactCss';
      linkA.rel = 'stylesheet';
      linkA.href = 'css/artefact.css?v=3';
      document.head.appendChild(linkA);
    }
    ensureAdminModules();
    if(document.getElementById('adminPanel')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = ADMIN_PANEL_HTML;
    const panel = wrap.firstElementChild;
    panel.classList.add('nautilus-admin-modal');
    document.body.appendChild(panel);
  }

  /* Logique du panneau. Regroupée dans une fonction : exécutée seulement sur les
     pages hors index, APRÈS injection du HTML (pour que les liaisons trouvent les
     éléments). Renvoie les commandes d'ouverture / fermeture. */
  function mountAdminLogic(){
  const TEAM_DEFS = [
    { code:"NEMO",     name:"Nemo" },
    { code:"NAUTILUS", name:"Nautilus" },
    { code:"ARONNAX",  name:"Aronnax" },
    { code:"NEDLAND",  name:"Ned Land" }
  ];
  const SERVICES = ["PE","PT","SAV","LOG","CAI","GAD","CODIR"];
  const STEPS = {
    start:{label:"Palier 1",next:"livres",time:0,errors:0,description:"Les sous-marins des équipages s'immergent depuis la surface. Votre équipage attend le feu vert pour plonger vers le Palier 1."},
    livres:{label:"Palier 2",next:"son",time:180,errors:6,description:"Plongée dans la pénombre des grandes profondeurs : les récits anciens guident les sous-marins sur la trace du submersible disparu."},
    son:{label:"Palier 3",next:"zone51",time:180,errors:1,description:"Chasse acoustique dans les abysses : identifiez et capturez au collimateur optique les 5 artefacts du secteur."},
    zone51:{label:"Palier 4 — Traque Sonar : Les Monstres des Abysses",next:"occasion",time:300,errors:3,description:"Traque acoustique dans la fosse : le Nautilus est encerclé par 4 léviathans abyssaux. Localisez et neutralisez le Kraken, le Calmar, l'Anguille et la Manta."},
    occasion:{label:"Palier 5",next:"papeterie",time:240,errors:3,description:"Approche du plancher sous-marin : estimez le prix exact de 10 articles pour déverrouiller les propulseurs d'exploration."},
    papeterie:{label:"Palier 6 — Le Grand Quiz des Abysses",next:"drone",time:100,errors:3,description:"Épreuve de culture et de sciences sous-marines : 10 questions pointues sur Nemo, le Nautilus et les fonds océaniques (6s de réflexion après écriture)."},
    drone:{label:"Palier 7",next:"final",time:300,errors:3,description:"Manœuvres d'amarrage : inspectez la carcasse du géant échoué et déverrouillez le sas de secours."},
    final:{label:"Palier final",next:null,time:0,errors:1,description:"Le Nautilus est sauvé ! Réamorcez ses ballasts et escortez le submersible dans sa remontée triomphale vers la surface."}
  };


  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=s=>String(s||'').trim().toUpperCase();
  const memberKey=name=>normalize(String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/gi,''));
  const simple=s=>normalize(String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,''));
  function teamCodeFromInput(value){
    const wanted = simple(value).replace(/[^A-Z0-9]/g, '');
    if(!wanted) return '';
    const found = TEAM_DEFS.find(t => simple(t.code) === wanted || simple(t.name).replace(/[^A-Z0-9]/g, '') === wanted);
    return found ? found.code : wanted;
  }
  function formatDate(iso){return iso?new Date(iso).toLocaleString('fr-FR'):'—';}
  async function getTeam(code){
    const cleanCode=teamCodeFromInput(code);
    let snap=await getDoc(doc(db,'teams',cleanCode));
    if(snap.exists()) return {teamCode:cleanCode,...snap.data()};
    return null;
  }
  function invalidateTeamsCache(){ _ensureTeamsPromise = null; _ensureTeamsAt = 0; }
  let _ensureTeamsPromise = null;
  let _ensureTeamsAt = 0;
  /* Mots anglais RÉELS de 4 lettres pour composer le Code Matelot :
     un mot anglais de 4 lettres (sans O) + 4 chiffres aléatoires de 1 à 9
     (pas de 0) — jamais « NEMO », jamais « 2026 ». */
  const MATELOT_WORDS = [
    'ABLE','ACID','ARMY','AWAY','BABY','BACK','BALL','BAND','BANK','BASE','BATH','BEAR','BEAT','BEER','BELL','BELT','BEND','BEST','BIRD','BITE','BLUE','BUSY','CAGE','CAKE','CALL','CALM','CAMP','CARD','CARE','CASE','CASH','CAST','CELL','CHAT','CHEF','CITY','CLUB','CREW','DATE','DAWN','DEAL','DEAR','DEBT','DESK','DIAL','DIET','DIRT','DISH','DRAW','DRUM','DUCK','DUST','DUTY','EACH','EARN','EASE','EAST','EASY','EDGE','ELSE','EVEN','EVER','EVIL','EXIT','FACE','FACT','FAIR','FALL','FARM','FAST','FEAR','FEED','FEEL','FILM','FIND','FINE','FIRE','FIRM','FISH','FIVE','FLAG','FLAT','FREE','FUEL','FULL','FUND','GAIN','GAME','GATE','GEAR','GIFT','GIRL','GIVE','GLAD','GRAB','GREY','HAIR','HALF','HALL','HAND','HANG','HARD','HEAD','HEAL','HEAR','HEAT','HELP','HERB','HIGH','HILL','HIRE','HUNT','HURT','IDEA','ITEM','JUMP','JUST','KEEN','KEEP','KICK','KIND','KING','KNEE','LAKE','LAND','LANE','LAST','LATE','LEAD','LEAF','LEFT','LEND','LESS','LIFE','LIFT','LIME','LIKE','LINE','LINK','LIST','LIVE','LUCK','MAIN','MAKE','MALE','MANY','MARK','MASS','MEAL','MEAN','MEAT','MEET','MENU','MILE','MILK','MIND','MINE','MISS','MUCH','NAME','NAVY','NEAR','NEED','NEWS','NEXT','NICE','NINE','PACE','PACK','PAGE','PAIN','PAIR','PARK','PART','PASS','PAST','PATH','PEAK','PEER','PICK','PINK','PIPE','PLAN','PLAY','PLUS','PULL','PURE','PUSH','RACE','RAIN','RANK','RARE','RATE','READ','REAL','REST','RICE','RICH','RIDE','RING','RISE','RISK','RULE','RUSH','SAFE','SAIL','SALE','SALT','SAME','SAND','SAVE','SEAT','SEED','SEEK','SELL','SEND','SEXY','SHIP','SIDE','SIGN','SILK','SING','SITE','SIZE','SKIN','SLIP','STAR','STAY','STEP','SPIN','SUCH','SURE','SWIM','TAKE','TALE','TALK','TALL','TANK','TAPE','TASK','TEAM','TELL','TEND','TERM','TEXT','THAN','THAT','THEM','THEN','THEY','THIN','THIS','TIME','TREE','TRIP','TRUE','TUNE','TURN','TYPE','UNIT','USED','USER','VAST','VERY','VIEW','WAIT','WAKE','WALK','WALL','WANT','WARM','WASH','WAVE','WEAK','WEAR','WEEK','WELL','WEST','WHAT','WHEN','WIDE','WIFE','WILD','WILL','WIND','WINE','WING','WIRE','WISE','WISH','WITH','YARD','YEAR'
  ];
  function generateMatelotCode(){
    let word;
    do { word = MATELOT_WORDS[Math.floor(Math.random()*MATELOT_WORDS.length)]; }
    while (word === 'NEMO');
    let digits = '';
    for(let i=0;i<4;i++) digits += (Math.floor(Math.random()*9)+1);
    return word + '-' + digits;
  }
  const MATELOT_CODE_RE = /^[A-Z]{4}-[0-9]{4}$/;
  const MISSION_DURATION_MS_DEFAULT = 7 * 24 * 60 * 60 * 1000;
  function formatInitialDuration(ms){
    const totalMinutes = Math.max(0, Math.round(Number(ms || MISSION_DURATION_MS_DEFAULT) / 60000));
    const mois = Math.floor(totalMinutes / (30 * 1440));
    const resteJours = totalMinutes % (30 * 1440);
    const jours = Math.floor(resteJours / 1440);
    const heures = Math.floor((resteJours % 1440) / 60);
    const minutes = resteJours % 60;
    const morceaux = [];
    if(mois) morceaux.push(mois + ' mois');
    if(jours) morceaux.push(jours + ' jour' + (jours > 1 ? 's' : ''));
    if(heures) morceaux.push(heures + ' heure' + (heures > 1 ? 's' : ''));
    if(!mois && !jours && !heures && minutes) morceaux.push(minutes + ' minute' + (minutes > 1 ? 's' : ''));
    return morceaux.join(' ') || '0 minute';
  }
  function getMissionDurationMs(){
    const v = missionConfig?.missionDurationMs;
    return (typeof v === 'number' && v > 0) ? v : MISSION_DURATION_MS_DEFAULT;
  }
  /* Format « XJ XXhXXmXXs » d'une durée (état « en attente du top départ »). */
  function formatCountdown(ms){
    let t = Math.max(0, Math.round(Number(ms || MISSION_DURATION_MS_DEFAULT)));
    const d = Math.floor(t / 86400000); t -= d * 86400000;
    const h = Math.floor(t / 3600000);  t -= h * 3600000;
    const m = Math.floor(t / 60000);    t -= m * 60000;
    const s = Math.floor(t / 1000);
    return `${d}J ${String(h).padStart(2,'0')}h${String(m).padStart(2,'0')}m${String(s).padStart(2,'0')}s`;
  }
  async function loadMissionConfig(){
    const snap = await getDoc(doc(db,'game','config'));
    missionConfig = snap.exists() ? snap.data() : {};
    return missionConfig;
  }
  let missionConfig=null;
  let currentTeam=null;
  // Ces fonctions rafraichissaient la page d'accueil (index.html). Dans le
  // panneau autonome elles n'ont rien a rafraichir.
  async function loadTeams(){}
  function renderGame(){}
  function updateCountdown(){}

  async function resetAllMembers(){
    const ok1 = confirm("⚠️ Action irréversible : vider l'équipage de toutes les équipes ?\n\nCela supprimera tous les noms de matelots inscrits ainsi que leurs Codes Matelot (reconnexion impossible).\nLes compteurs « en ligne » sont également remis à zéro.\nLa progression et le blocage des équipes ne sont PAS affectés.");
    if(!ok1) return;
    const ok2 = confirm("Confirme une seconde fois : tu veux vraiment purger TOUS les membres ?");
    if(!ok2) return;
    try{
      await refreshAdminTeams();
      let purged = 0;
      for(const t of effectiveTeams){
        const teamRef = doc(db,'teams',t.code);
        const snap = await getDoc(teamRef);
        if(!snap.exists()) continue;
        // Sous-collection matelots + index global
        const matelotsSnap = await getDocs(collection(db,'teams',t.code,'matelots'));
        for(const d of matelotsSnap.docs){
          const code = d.data().codeMatelot || d.id;
          await deleteDoc(doc(db,'matelots',code)).catch(() => {});
          await deleteDoc(d.ref).catch(() => {});
          purged++;
        }
        // Codes presents dans members[] mais sans fiche (inscriptions anciennes)
        for(const m of (snap.data().members || [])){
          if(m.codeMatelot && !matelotsSnap.docs.some(d => (d.data().codeMatelot || d.id) === m.codeMatelot)){
            await deleteDoc(doc(db,'matelots',m.codeMatelot)).catch(() => {});
            purged++;
          }
        }
        /* onlinePlayers doit etre vide lui aussi : il contient les
           horodatages des appareils connectes, un par session. Sans cela,
           les traces des matelots qu'on vient de supprimer resteraient dans
           la base apres le reset. Plus de matelots = plus personne en ligne. */
        await updateDoc(teamRef, {
          members: [],
          onlinePlayers: {},
          updatedAt: new Date().toISOString()
        });

        /* La partie en cours du mini-jeu doit tomber elle aussi : elle
           porte le nom du matelot qui l'avait lancee. Sans cela, un
           matelot qu'on vient de supprimer resterait "aux commandes du
           protocole" et empecherait les nouveaux inscrits de jouer. */
        await setDoc(doc(db,'teams',t.code,'morseSession','current'),
          { state:'idle', clearedAt:new Date().toISOString() })
          .catch(e => console.warn('reset session', t.code, e));
      }
      endAdminSession(`✅ ${purged} matelot(s) supprimé(s) · session fermée`);
      await loadTeams();
    }catch(err){
      console.error('NAUTILUS resetAllMembers error:', err);
      alert(`❌ Échec du reset : ${err.message || err}`);
    }
  }
  async function resetAllProgress(){
    // La liste est lue dans Firestore : le message annonce les equipes
    // reellement presentes, pas une liste figee dans le code.
    await refreshAdminTeams();
    if(!effectiveTeams.length){ alert('Aucune équipe dans la base.'); return; }
    const noms = effectiveTeams.map(t => t.name).join(', ');
    const ok1 = confirm(`⚠️ Action irréversible : remettre à zéro la progression de ${effectiveTeams.length} équipe(s) ?\n\n(${noms})\n→ currentStep=start, failCount=0, blocages des matelots effacés, completedSteps=[]\n\nLes membres inscrits sont conservés.`);
    if(!ok1) return;
    const ok2 = confirm("Confirme une seconde fois : reset complet de la progression ?");
    if(!ok2) return;
    try{
      let done = 0;
      for(const t of effectiveTeams){
        const teamRef = doc(db,'teams',t.code);
        const snap = await getDoc(teamRef);
        if(!snap.exists()) continue; // supprimee entre-temps
        await updateDoc(teamRef, {
          currentStep: 'start',
          status: 'active',
          lockedUntil: null,
          failCount: 0,
          lastLockHours: 0,
          /* Les blocages personnels des matelots font partie de la
             progression : un reset doit les effacer, sinon un matelot
             resterait en surface alors que tout repart de zero. */
          matelotLocks: {},
          completedSteps: [],
          finishedAt: null,
          batailleNavale: deleteField(),
          updatedAt: new Date().toISOString()
        });
        try { localStorage.removeItem('nautilusP4Partie:' + t.code); } catch(e){}
        if (window.NautilusBataille && window.NautilusBataille.reinitialiser) {
          window.NautilusBataille.reinitialiser(t.code);
        }

        /* La partie en cours du mini-jeu vit dans un AUTRE document.
           Elle n'etait pas remise a zero ici : apres un reset, l'equipage
           retrouvait sa vieille partie, chronometre a 00:00, sans pouvoir
           relancer quoi que ce soit. Un reset de progression doit rendre
           l'equipage entierement neuf, mini-jeu compris. */
        await setDoc(doc(db,'teams',t.code,'morseSession','current'),
          { state:'idle', clearedAt:new Date().toISOString() })
          .catch(e => console.warn('reset session', t.code, e));
        done++;
      }
      endAdminSession(`✅ Progression remise à zéro pour ${done} équipe(s) · session fermée`);
      if(currentTeam){
        const fresh = await getTeam(currentTeam.teamCode);
        if(fresh) currentTeam = fresh;
      }
      renderGame();
      await loadTeams();
    }catch(err){
      console.error('NAUTILUS resetAllProgress error:', err);
      alert(`❌ Échec du reset : ${err.message || err}`);
    }
  }

  function isTestMatelotMember(m){
    return !!m && (m.codeMatelot === TEST_MATELOT_CODE || m.memberKey === 'TEST'
      || (m.name && String(m.name).toUpperCase().trim() === 'TEST'));
  }

  async function cleanupTestSessions(){
    if(!isAdminUnlocked()) return;
    try{
      await refreshAdminTeams();
      if(!effectiveTeams.length){ alert('Aucune équipe dans la base.'); return; }

      const trouvees = [];
      for(const t of effectiveTeams){
        const ref = doc(db,'teams',t.code,'morseSession','current');
        const snap = await getDoc(ref);
        if(!snap.exists()) continue;
        const d = snap.data() || {};
        const estTest = d.startedByMatelot === TEST_MATELOT_CODE
                     || d.isTest === true
                     || d.startedByName === 'TEST';
        if(estTest) trouvees.push({ kind:'session', code: t.code, nom: t.name, ref, etat: d.state || '?' });
      }

      for(const t of effectiveTeams){
        const tref = doc(db,'teams',t.code);
        const tsnap = await getDoc(tref);
        if(!tsnap.exists()) continue;
        const d = tsnap.data() || {};
        const patch = {};
        const details = [];
        const membres = d.members || [];
        const membresRestants = membres.filter(m => !isTestMatelotMember(m));
        if(membresRestants.length !== membres.length){
          patch.members = membresRestants;
          details.push(`${membres.length - membresRestants.length} membre(s) TEST`);
        }
        if(d.matelotLocks && Object.prototype.hasOwnProperty.call(d.matelotLocks,'TEST')){
          const l2 = { ...d.matelotLocks };
          delete l2.TEST;
          patch.matelotLocks = l2;
          details.push('1 blocage TEST');
        }
        if(d.onlineMatelots && Object.prototype.hasOwnProperty.call(d.onlineMatelots,'TEST')){
          const o2 = { ...d.onlineMatelots };
          delete o2.TEST;
          patch.onlineMatelots = o2;
          details.push('1 présence TEST');
        }
        if(details.length) trouvees.push({ kind:'fiche', code: t.code, nom: t.name, ref: tref, patch, detail: details.join(' + ') });
      }

      if(!trouvees.length){
        alert('✅ Aucune trace du compte de test en base (parties, membres, blocages). Rien à purger.');
        return;
      }

      const liste = trouvees.map(x => x.kind === 'session'
        ? `• ${x.nom} : partie de test (${x.etat})`
        : `• ${x.nom} : ${x.detail}`).join('\n');
      if(!confirm(`${trouvees.length} trace(s) du compte de test (ZZZZ-0000) trouvée(s) :\n\n${liste}\n\n`
        + `Les supprimer ? Le compte de test ne doit jamais faire partie d'un équipage.`)) return;

      for(const x of trouvees){
        if(x.kind === 'session'){
          await setDoc(x.ref, { state:'idle', clearedAt:new Date().toISOString() });
        }else{
          await updateDoc(x.ref, { ...x.patch, updatedAt:new Date().toISOString() });
        }
      }
      try {
        localStorage.removeItem('nautilusP4Partie:TEST');
        localStorage.removeItem('nautilusP4Partie:ZZZZ-0000');
        if (window.NautilusBataille && window.NautilusBataille.reinitialiser) {
          window.NautilusBataille.reinitialiser('TEST');
        }
      } catch (e) {}
      await loadTeams();
      endAdminSession(`✅ ${trouvees.length} trace(s) du compte de test purgée(s) · session fermée`);
    }catch(err){
      console.error('cleanupTestSessions:', err);
      alert(`❌ Échec de la purge : ${err.message || err}`);
    }
  }

  async function cleanupObsoleteFields(){
    await refreshAdminTeams();
    if(!effectiveTeams.length){ alert('Aucune équipe dans la base.'); return; }

    const concerned = [];
    for(const t of effectiveTeams){
      const snap = await getDoc(doc(db,'teams',t.code));
      if(snap.exists() && snap.data().migratedFrom !== undefined){
        concerned.push(t.name);
      }
    }
    if(!concerned.length){
      alert('✅ Rien à nettoyer : aucune fiche ne contient de champ obsolète.');
      return;
    }

    const ok = confirm(
      `Nettoyer le champ obsolète « migratedFrom » sur ${concerned.length} équipe(s) ?\n\n` +
      `(${concerned.join(', ')})\n\n` +
      `Ce champ est un reste de l'ancienne migration des identifiants d'équipe.\n` +
      `Il n'est plus utilisé nulle part : sa suppression n'a aucun effet sur le jeu.`
    );
    if(!ok) return;

    try{
      let done = 0;
      for(const t of effectiveTeams){
        const ref = doc(db,'teams',t.code);
        const snap = await getDoc(ref);
        if(!snap.exists() || snap.data().migratedFrom === undefined) continue;
        await updateDoc(ref, {
          migratedFrom: deleteField(),
          updatedAt: new Date().toISOString()
        });
        done++;
      }
      endAdminSession(`✅ Champ obsolète retiré de ${done} équipe(s) · session fermée`);
      await loadTeams();
    }catch(err){
      console.error('NAUTILUS cleanupObsoleteFields error:', err);
      alert(`❌ Échec du nettoyage : ${err.message || err}`);
    }
  }
  /* Clé « aperçu » : elle prouve que le lien vient du panneau admin.
     Dérivée du code d'accès par une formule volontairement simple (le jeu
     n'a pas d'enjeu de sécurité forte, mais le paramètre ?apercu seul ne
     doit pas suffire à un joueur curieux).
     À GARDER EN PHASE avec apercuAdminCleAttendue() de palier1.html. */
  function apercuAdminCle(){
    let h = 0;
    const s = 'apercu-admin:' + ADMIN_CODE;
    for(let i = 0; i < s.length; i++){ h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return 'k' + Math.abs(h).toString(36);
  }

  /* Calcul automatique de l'URL de page pour chacun des 8 paliers.
     Convention mathématique : [16,1,12,9,5,18] + idx.
     Palier 1 = palier1.html ; Paliers 2..8 = 1721310619.html, etc. */
  function palierPageUrl(stepId){
    const idx = Object.keys(STEPS).indexOf(stepId);
    if(idx < 0) return null;
    if(idx === 0) return 'palier1.html?code=NEMO&m=ZZZZ-0000';
    return [16,1,12,9,5,18].map(n => String(n + idx)).join('') + '.html';
  }

  function getMeilleurPalierAtteintAdmin(){
    if (typeof window.getMeilleurPalierAtteint === 'function') {
      try {
        const r = window.getMeilleurPalierAtteint();
        if (typeof r === 'number' && r >= 1) return r;
      } catch (e) {}
    }
    let teams = window._lastTeams || [];
    if (!teams.length) {
      try {
        const local = JSON.parse(localStorage.getItem('nautilusTeamsCache') || '[]');
        if (Array.isArray(local) && local.length) teams = local;
      } catch (e) {}
    }
    let maxRank = 1;
    const stepKeys = Object.keys(STEPS);
    teams.forEach(t => {
      if (!t) return;
      if (t.status === 'finished' || (t.completedSteps && t.completedSteps.includes('final'))) {
        maxRank = 8;
        return;
      }
      const completed = t.completedSteps || [];
      const currIdx = stepKeys.indexOf(t.currentStep);
      let r = currIdx >= 0 ? (currIdx + 1) : 1;
      if (completed.length > 0) {
        const compRank = completed.length + 1;
        if (compRank > r) r = compRank;
      }
      if (r > maxRank) maxRank = Math.min(8, r);
    });
    return maxRank;
  }

  function syncAdminTestPalierBadge(){
    const rank = getMeilleurPalierAtteintAdmin();
    const stepKeys = Object.keys(STEPS);
    const key = stepKeys[Math.max(0, Math.min(stepKeys.length - 1, rank - 1))];
    const label = STEPS[key]?.label || `Palier ${rank}`;
    const b1 = $('adminActivePalierBadge');
    if(b1) b1.textContent = label;
    const b2 = $('adminQuickActivePalierBadge');
    if(b2) b2.textContent = label;
  }

  /* « TESTER TOUTES LES PAGES » : chaque page du jeu (génération automatique
     des 8 paliers) + aperçus d'écrans du Palier 1, ouverts dans un onglet isolé.
     Chaque palier dispose de son bouton direct de test de notification. */
  function renderDesignerAccess(){
    if(!isAdminUnlocked()) { alert('Déverrouille d’abord le panneau admin.'); return; }
    const box = $('adminDesignerBox');
    const btn = $('adminDesignerBtn');
    if(!box) return;
    const lien = (href, label) => {
      const sep = href.indexOf('?') >= 0 ? '&' : '?';
      const urlFrais = href + sep + '_v=' + Date.now();
      return `<a href=\"${urlFrais}\" target=\"_blank\" rel=\"noopener\" style=\"background:var(--fnac);color:#111;border-radius:7px;padding:6px 9px;font-size:12px;font-weight:900;text-decoration:none;white-space:nowrap\">${label}</a>`;
    };
    const ligne = (titre, note, actionHtml, dispo) =>
      `<div class=\"ds-row\" style=\"display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;margin-top:5px;border-radius:8px;background:${dispo ? 'rgba(91,224,155,.18)' : 'rgba(142,231,255,.08)'};border:1px solid ${dispo ? 'rgba(91,224,155,.5)' : 'rgba(142,231,255,.25)'};color:#f2f8fc;\">
        <span class=\"ds-row-main\" style=\"flex:1 1 auto;min-width:0;overflow-wrap:anywhere\">${titre}${note ? ' <span class=\"small\">' + note + '</span>' : ''}</span><span class=\"ds-row-actions\" style=\"display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center;flex:0 0 auto\">${actionHtml}</span>
      </div>`;
    const sectionHtml = (titre) =>
      `<div class=\"small\" style=\"font-weight:900;color:#8ee7ff;margin:10px 0 0\">${titre}</div>`;
    const k = apercuAdminCle();

    const activeRank = getMeilleurPalierAtteintAdmin();
    const stepKeys = Object.keys(STEPS);
    const activeKey = stepKeys[Math.max(0, Math.min(stepKeys.length - 1, activeRank - 1))];
    const activeLabel = STEPS[activeKey]?.label || `Palier ${activeRank}`;

    const notesParPalier = {
      start: 'épreuve morse — compte de test',
      livres: 'mots croisés',
      son: 'chasse aux artefacts',
      zone51: 'traque sonar (monstres des abysses)',
      occasion: 'le juste prix',
      papeterie: 'le grand quiz des abysses',
      drone: 'vue aérienne',
      final: 'sas final de surface'
    };

    const optionsPaliersHtml = stepKeys.map(id =>
      `<option value=\"${id}\">${STEPS[id].label}</option>`
    ).join('');

    const lignes = [
      sectionHtml('🧭 TESTER TOUTES LES PAGES DU SITE'),
      ligne('🏠 <b>Accueil</b>', 'page de lancement', lien('index.html', 'Ouvrir'), true),
      ligne('🏁 <b>Classement</b>', 'podium de fin de mission', lien('classement.html', 'Ouvrir'), true),
      sectionHtml('PALIERS — pages de jeu (génération automatique 1 à 8)')
    ];

    Object.entries(STEPS).forEach(([id, step], index) => {
      const href = palierPageUrl(id);
      const isStart = id === 'start';
      let actions = '';
      if (isStart) {
        actions = lien(href, '🕹️ Jouer l’épreuve');
      } else {
        actions = lien(href + '?sas=ferme&m=ZZZZ-0000', '🔒 Page scellée (tester le QR)') + ' '
          + lien(href + '?apercu=jeu&k=' + k + '&m=ZZZZ-0000', '🕹️ Jouer l’épreuve');
      }
      lignes.push(ligne(`<b>${index + 1}.</b> ${esc(step.label)}`, notesParPalier[id] || '', actions, true));
    });

    lignes.push(sectionHtml('🏆 ÉCRANS & POPUPS DE FIN D’ÉPREUVE (Aperçus en direct)'));
    [
      ['victoire', '🏆 Épreuve validée (victoire)', 'succès & palier franchi'],
      ['defaite', '↟ Retour en surface (défaite)', 'remontée forcée & relais équipe'],
      ['blocage', '🔒 Blocage personnel d’un matelot', 'pénalité & temps d’attente']
    ].forEach(([mode, titre, note]) => {
      lignes.push(ligne(titre, note, lien(`palier1.html?apercu=${mode}&k=${k}`, 'Tester l’écran'), true));
    });

    box.innerHTML = lignes.join('');

    box.style.display = box.style.display === 'none' ? 'block' : 'none';
    if(btn) btn.textContent = box.style.display === 'none' ? '🧪 Tester toutes les pages' : '🔽 Masquer les tests de pages';
  }

  let _adminCycleIndex = 0;
  async function testerAnnonceVerte(explicitStepId, explicitPalierLabel){
    let NA = window.NautilusAnnonces;
    if(!NA || !NA.showPalierAnnouncement){
      try {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'palier-annonces.js?v=5';
          s.onload = res;
          s.onerror = rej;
          document.head.appendChild(s);
        });
        NA = window.NautilusAnnonces;
      } catch(e) {}
    }

    const stepKeys = Object.keys(STEPS);
    let targetStep = explicitStepId;
    let targetLabel = explicitPalierLabel;

    if(!targetStep){
      const sel = $('adminSelectPalierTest');
      const val = sel ? sel.value : 'auto';
      if(val && val !== 'auto' && stepKeys.includes(val)){
        targetStep = val;
        targetLabel = STEPS[val]?.label || val;
      } else {
        const leaderRank = getMeilleurPalierAtteintAdmin();
        const baseIdx = Math.max(0, Math.min(stepKeys.length - 1, leaderRank - 1));
        const idx = (_adminCycleIndex === 0 ? baseIdx : (_adminCycleIndex % stepKeys.length));
        _adminCycleIndex = (idx + 1) % stepKeys.length;
        targetStep = stepKeys[idx];
        targetLabel = STEPS[targetStep]?.label || `Palier ${idx + 1}`;
      }
    }

    const b1 = $('adminActivePalierBadge');
    if(b1) b1.textContent = targetLabel;
    const b2 = $('adminQuickActivePalierBadge');
    if(b2) b2.textContent = targetLabel;

    let cheer = '⚡ Les circuits du submersible tressaillent au fond de la fosse : la machinerie s’éveille !';
    if(NA && NA.misesEnGardeParEtape && NA.misesEnGardeParEtape[targetStep]){
      cheer = NA.misesEnGardeParEtape[targetStep];
    } else if(NA && typeof NA.encouragementPour === 'function'){
      cheer = NA.encouragementPour(targetStep, 0);
    }

    if(NA && NA.showPalierAnnouncement){
      NA.showPalierAnnouncement({
        teamName: 'Équipage démo',
        palierLabel: targetLabel,
        encouragement: cheer
      });
      if(NA.playVictorySound) NA.playVictorySound(true);
    } else {
      try {
        const a = new Audio('assets/Victoire.mp3');
        a.volume = 0.85;
        a.play().catch(() => {});
      } catch(e) {}
    }
  }


  /* =====================================================================
     PANNEAU ADMIN — bouton engrenage en bas-gauche
     Code d'accès : NEMO2026
     - AUCUNE session persistante. À chaque clic sur l'engrenage,
       le code est RE-DEMANDÉ. La validation ouvre le panneau pour
       une seule séquence d'actions ; la moindre fermeture
       (✕, engrenage, succès d'action) invalide l'accès.
     - Flag en mémoire JS pure (`adminSessionOpen`), jamais écrit
       dans sessionStorage / localStorage. Volatil : un refresh
       de page = nouveau prompt obligatoire.
     ===================================================================== */
  const ADMIN_CODE = 'NEMO2026';
  let adminSessionOpen = false;

  function isAdminUnlocked(){ return adminSessionOpen === true; }
  function openAdminSession(){ adminSessionOpen = true; }
  function closeAdminSession(){
    adminSessionOpen = false;
    wipeAdminCode();
  }

  /* Liste effective des équipes (initiale + ajoutées via admin).
     On relit `customTeams` dans `game/config` à chaque ouverture du panneau. */
  let effectiveTeams = []; // rempli par refreshAdminTeams() depuis Firestore

  function openAdminPanel(){
    ensureAdminModules();
    const panel = $('adminPanel');
    if(!panel) return;
    // Overlay fixe : on affiche la classe .open (CSS), plus besoin de
    // faire defiler la page vers le bas du document.
    panel.classList.add('open');
    panel.style.display = '';
    $('adminFabBtn')?.classList.add('active');
    // Verrouille le scroll de la page derriere la modale.
    document.body.classList.add('admin-modal-open');
    document.body.style.overflow = 'hidden';
    // Cache le footer (l'engrenage ne doit pas rester visible pendant qu'on tape le code)
    document.querySelector('.site-footer')?.classList.add('admin-open');
    // TOUJOURS demander le code à chaque clic sur l'engrenage.
    // Pas de session persistante : le code doit être retapé à chaque ouverture.
    $('adminLocked').style.display = '';
    $('adminWorkspace').style.display = 'none';
    wipeAdminCode();
    const msg = $('adminUnlockMsg');
    if(msg){ msg.textContent = ''; msg.style.color = ''; }
    setTimeout(() => $('adminCodeInput')?.focus(), 80);
  }
  function closeAdminPanel(){
    const panel = $('adminPanel');
    if(panel){ panel.classList.remove('open'); panel.style.display = 'none'; }
    document.body.classList.remove('admin-modal-open');
    document.body.style.overflow = '';
    $('adminFabBtn')?.classList.remove('active');
    document.querySelector('.site-footer')?.classList.remove('admin-open');
    // Toujours purger la session à la fermeture (volatil, pas de 30 min)
    closeAdminSession();
  }
  // Ferme la modale quand on clique sur le fond sombre (pas sur la carte).
  $('adminPanel')?.addEventListener('click', e => {
    if(e.target === $('adminPanel')) closeAdminPanel();
  });
  /**
   * Vide le champ code admin de manière agressive (mémoire JS + DOM).
   * Appelé après chaque action admin sensible (endAdminSession), sur tentative
   * échouée, à la fermeture du panneau et au blur du champ.
   * Garantit que le mot de passe n'est jamais retenu en mémoire, ni
   * récupérable via autofill / inspecteur après la session.
   *
   * Masquage : la vraie valeur n'est jamais écrite dans le DOM (on n'affiche
   * que des •). La valeur de référence vit dans adminCodeBuffer (mémoire JS
   * volatile, wiped ici).
   */
  let adminCodeBuffer = '';
  function wipeAdminCode(){
    const input = $('adminCodeInput');
    if(!input) return;
    input.value = '';
    adminCodeBuffer = '';
    // Force l'autofill à purger son cache en réécrivant la valeur
    if(typeof input.setAttribute === 'function'){
      input.setAttribute('value', '');
    }
    try{ input.dispatchEvent(new Event('input', { bubbles: true })); }catch(e){}
  }
  /**
   * Listener "input" : capture la frappe, écrit la vraie valeur dans
   * adminCodeBuffer (mémoire JS uniquement), puis remplace l'affichage par
   * une chaîne de • de même longueur. Le DOM ne contient jamais la vraie
   * valeur. La comparaison se fait dans tryAdminUnlock() sur adminCodeBuffer.
   *
   * Algorithme :
   * 1. Quand le DOM contient des caractères non-•, c'est la frappe de l'user
   *    (lettre, paste, IME). On extrait le delta et on l'ajoute au buffer.
   * 2. Quand le DOM ne contient que des •, l'user a fait Backspace/Delete :
   *    on raccourcit le buffer proportionnellement.
   * 3. On réaffiche toujours des • dans le DOM.
   */
  function maskAdminInput(){
    const input = $('adminCodeInput');
    if(!input) return;
    const raw = String(input.value || '');
    const isOnlyDots = raw === '' || /^•+$/.test(raw);

    if(!isOnlyDots){
      // Caractères en clair (frappe, paste, IME)
      // On retire les • existants (qui représentent ce qui est déjà bufferisé)
      // et on garde le delta.
      const dotsInRaw = (raw.match(/•/g) || []).length;
      const clearChars = raw.replace(/•/g, '');
      // Stratégie : les • correspondent au début du buffer ; les clearChars
      // sont les nouveaux caractères tapés à la suite. Si l'utilisateur
      // édite au milieu, on simplifie : on garde clearChars comme nouveau buffer.
      // (Pour ADMIN_CODE = 8 caractères sans édition complexe, ça suffit.)
      const baseFromDots = adminCodeBuffer.slice(0, dotsInRaw);
      adminCodeBuffer = baseFromDots + clearChars;
    }else if(raw === ''){
      // Tout effacé
      adminCodeBuffer = '';
    }else{
      // Que des •, longueur diminuée → Backspace
      adminCodeBuffer = adminCodeBuffer.slice(0, raw.length);
    }

    // Réaffiche uniquement des •
    const masked = '•'.repeat(adminCodeBuffer.length);
    if(input.value !== masked){
      input.value = masked;
    }
  }
  function showAdminWorkspace(){
    $('adminLocked').style.display = 'none';
    $('adminWorkspace').style.display = '';
    syncAdminTestPalierBadge();
    switchAdminTab('members');
    refreshAdminTeams();
    renderAdminMembers();
    renderAdminLocks();
    renderAdminOxygen();
    renderAdminTeams();
  }
  function tryAdminUnlock(){
    const input = $('adminCodeInput');
    const msg = $('adminUnlockMsg');
    if(!input) return;
    // Comparaison sur la valeur en mémoire (jamais écrite dans le DOM)
    const typed = String(adminCodeBuffer || '').trim();
    if(typed === ADMIN_CODE){
      openAdminSession();
      if(msg){ msg.textContent = '✅ Code accepté.'; msg.style.color = '#075c39'; }
      wipeAdminCode(); // Purge immédiate du champ après succès
      showAdminWorkspace();
    }else{
      closeAdminSession();
      if(msg){ msg.textContent = '❌ Code invalide.'; msg.style.color = '#9b1111'; }
      wipeAdminCode();
      input.focus();
    }
  }

  /**
   * Termine DÉFINITIVEMENT la session admin après une action sensible.
   * - Supprime le flag de session (annule les 30 min)
   * - Ferme le panneau admin
   * - Le prochain accès exigera une nouvelle saisie du code
   * Appelée à la fin de chaque modification / ajout / suppression.
   */
  function endAdminSession(message){
    closeAdminSession();
    wipeAdminCode();
    closeAdminPanel();
    if(message){
      // Notification éphémère (toast simple)
      try{
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = 'position:fixed;right:20px;bottom:80px;z-index:10003;background:linear-gradient(135deg,#075c39,#0a8a5a);color:#fff;padding:14px 18px;border-radius:14px;font-weight:900;box-shadow:0 14px 28px rgba(0,0,0,.32);font-size:13px;max-width:min(90vw,360px);border:1px solid rgba(255,255,255,.18)';
        document.body.appendChild(toast);
        setTimeout(() => toast.style.opacity = '0', 2200);
        setTimeout(() => toast.remove(), 2700);
      }catch(e){}
    }
  }

  $('adminFabBtn')?.addEventListener('click', () => {
    const panel = $('adminPanel');
    if(!panel) return;
    // Panel est considéré "fermé" si display === 'none' OU si l'attribut hidden est présent
    const isClosed = panel.style.display === 'none' || panel.hasAttribute('hidden');
    if(isClosed){
      openAdminPanel();
    }else{
      closeAdminPanel();
    }
  });
  $('adminCodeInput')?.addEventListener('keydown', e => { if(e.key === 'Enter') tryAdminUnlock(); });
  $('adminCodeInput')?.addEventListener('input', maskAdminInput);
  // Bloque la composition IME (sinon le user voit ses caractères avant masquage)
  $('adminCodeInput')?.addEventListener('compositionstart', e => { e.target.dataset.composing = '1'; });
  $('adminCodeInput')?.addEventListener('compositionend', e => { delete e.target.dataset.composing; maskAdminInput(); });
  $('adminCodeInput')?.addEventListener('blur', () => {
    // Purge dès qu'on quitte le champ (l'admin a fini de taper)
    setTimeout(wipeAdminCode, 100);
  });
  $('adminCodeInput')?.addEventListener('paste', e => {
    // Le code doit être tapé, pas collé depuis un presse-papier (sécurité optionnelle)
    e.preventDefault();
  });
  $('adminCloseBtn')?.addEventListener('click', closeAdminPanel);
  // Purge si l'utilisateur quitte l'onglet ou la fenêtre
  document.addEventListener('visibilitychange', () => {
    if(document.hidden) wipeAdminCode();
  });
  window.addEventListener('pagehide', wipeAdminCode);
  window.addEventListener('beforeunload', wipeAdminCode);
  $('adminReloadBtn')?.addEventListener('click', () => {
    refreshAdminTeams().then(() => { renderAdminMembers(); renderAdminLocks(); renderAdminTeams(); });
  });

  /* Onglets */
  function switchAdminTab(tab){
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.admin-pane').forEach(p => p.style.display = (p.dataset.pane === tab ? '' : 'none'));
    if(tab === 'oxygen') renderAdminOxygen();
  }
  document.querySelectorAll('.admin-tab').forEach(b => b.addEventListener('click', () => switchAdminTab(b.dataset.tab)));

  /* Le panneau admin doit refleter EXACTEMENT la collection Firestore.
     On lit donc teams/ directement : une equipe supprimee dans Firebase
     disparait du panneau, et une equipe ajoutee a la main y apparait.
     TEAM_DEFS ne sert plus qu'a distinguer les equipes par defaut des
     equipes custom (badge + confirmation renforcee a la suppression). */
  /* Construit la liste d'equipes utilisee par le panneau admin.
     `preloaded` : liste deja lue par l'appelant. Quand elle est fournie, on
     ne relit RIEN — c'est le cas de loadTeams(), qui vient justement de lire
     la collection. Sans argument, le comportement d'origine est conserve
     (lecture complete), pour tous les appels du panneau admin. */
  async function refreshAdminTeams(preloaded){
    try{
      const rows = preloaded
        ? preloaded.map(t => ({ teamCode: t.teamCode, data: t }))
        : (await getDocs(collection(db,'teams'))).docs.map(d => ({ teamCode: d.id, data: d.data() }));
      effectiveTeams = rows
        .map(r => {
          const defaultTeam = TEAM_DEFS.find(t => t.code === r.teamCode);
          return {
            code: r.teamCode,
            // Le code ARONNAX reste la clé Firestore, mais l'interface doit
            // présenter le nom propre « Aronnax » sur chaque palier.
            name: defaultTeam?.name || r.data.teamName || r.teamCode,
            memberCount: (r.data.members || []).length
          };
        })
        .sort((a, b) => {
          // Equipes par defaut d'abord, dans l'ordre de TEAM_DEFS, puis les autres
          const ia = TEAM_DEFS.findIndex(t => t.code === a.code);
          const ib = TEAM_DEFS.findIndex(t => t.code === b.code);
          if(ia !== -1 && ib !== -1) return ia - ib;
          if(ia !== -1) return -1;
          if(ib !== -1) return 1;
          return a.name.localeCompare(b.name, 'fr');
        });
    }catch(e){
      console.warn('refreshAdminTeams:', e);
      effectiveTeams = [];
    }
  }

  /* ---------- TAB : MEMBRES ---------- */
  async function renderAdminMembers(){
    if(!isAdminUnlocked()) return;
    const box = $('adminMembersBox');
    if(!box) return;
    box.innerHTML = '<div class="small">Chargement…</div>';
    try{
      await refreshAdminTeams();
      fillAddMemberSelects();
      const teams = [];
      for(const t of effectiveTeams){ const team = await getTeam(t.code); if(team) teams.push(team); }
      const allMembers = [];
      for(const t of teams){
        for(const m of (t.members || [])){
          allMembers.push({ ...m, _teamCode: t.teamCode, _teamName: t.teamName });
        }
      }
      if(!allMembers.length){
        box.innerHTML = '<div class="small">Aucun matelot inscrit pour le moment.</div>';
        return;
      }
      const teamOptions = effectiveTeams.map(t => `<option value="${esc(t.code)}">${esc(t.name)}</option>`).join('');
      const serviceOptions = SERVICES.map(s => `<option value="${s}">${s}</option>`).join('');
      box.innerHTML = `<div class="team">
        <h3>${allMembers.length} matelot(s) inscrit(s)</h3>
        <div class="hr"></div>
        ${allMembers.map((m, idx) => `
          <div class="member-edit-row" data-key="${esc(m.memberKey || '')}" data-team="${esc(m._teamCode)}" data-code="${esc(m.codeMatelot || '')}">
            <input type="text" class="me-name" value="${esc(m.name || '')}" placeholder="Nom">
            <div class="me-sub">
              <select class="me-svc">${serviceOptions.replace(`value="${esc(m.service)}"`, `value="${esc(m.service)}" selected`)}</select>
              <select class="me-team">${teamOptions.replace(`value="${esc(m._teamCode)}"`, `value="${esc(m._teamCode)}" selected`)}</select>
            </div>
            <input type="text" class="me-code" value="${esc(m.codeMatelot || '')}" placeholder="ABCD-1234"
                   maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false"
                   title="Code Matelot — sert au joueur pour reprendre sa mission">
            <div class="me-actions">
              <button class="primary mini me-save" type="button" style="background:var(--fnac);color:#111">💾</button>
              <button class="danger mini me-del" type="button">🗑</button>
            </div>
          </div>
        `).join('')}
      </div>`;

      // Bind save/delete
      box.querySelectorAll('.member-edit-row').forEach(row => {
        const key = row.dataset.key;
        const oldTeam = row.dataset.team;
        const oldCode = row.dataset.code || '';
        row.querySelector('.me-save').addEventListener('click', async () => {
          const newName = row.querySelector('.me-name').value.trim().toUpperCase();
          const newSvc = row.querySelector('.me-svc').value;
          const newTeamCode = row.querySelector('.me-team').value;
          const codeEl = row.querySelector('.me-code');
          const newCode = (codeEl.value || '').trim().toUpperCase();
          if(!newName){ alert('Le nom ne peut pas être vide.'); return; }

          // Le code doit respecter le format, sinon le joueur ne pourra
          // plus se reconnecter. Champ vide accepte : le matelot n'aura
          // simplement pas de code (cas des inscriptions tres anciennes).
          codeEl.classList.remove('me-code-bad');
          if(newCode && !MATELOT_CODE_RE.test(newCode)){
            codeEl.classList.add('me-code-bad');
            alert('Code Matelot invalide.\n\nFormat attendu : 4 lettres, un tiret, 4 chiffres.\nExemple : ABCD-1234');
            return;
          }
          if(newCode !== oldCode && newCode){
            // ZZZZ-0000 est reserve au compte de test interne : l'attribuer
            // a un vrai matelot creerait deux identites sur le meme code.
            if(newCode === TEST_MATELOT_CODE){
              codeEl.classList.add('me-code-bad');
              alert(`Le code ${TEST_MATELOT_CODE} est réservé au compte de test interne.\n\nChoisis un autre code.`);
              return;
            }
            // Un code doit rester unique : deux matelots avec le meme code
            // se connecteraient sur la meme fiche.
            const taken = await getDoc(doc(db,'matelots',newCode));
            if(taken.exists()){
              codeEl.classList.add('me-code-bad');
              alert(`Le code ${newCode} est déjà attribué à un autre matelot.\n\nChoisis un code différent.`);
              return;
            }
            if(!confirm(`Changer le Code Matelot de ${newName} ?\n\n${oldCode || '(aucun)'}  →  ${newCode}\n\nL'ancien code ne fonctionnera plus, et le QR déjà remis au matelot deviendra inutilisable.`)) return;
          }
          await adminMoveOrRenameMember(oldTeam, key, { name: newName, service: newSvc }, newTeamCode, { oldCode, newCode });
        });
        row.querySelector('.me-del').addEventListener('click', async () => {
          if(!confirm(`Supprimer définitivement ce matelot de l'équipe ?`)) return;
          await adminDeleteMember(oldTeam, key);
        });
      });
    }catch(err){
      console.error('renderAdminMembers:', err);
      box.innerHTML = `<div class="notice warning">Erreur : ${esc(err.message || err)}</div>`;
    }
  }

  /* Un Code Matelot existe a TROIS endroits (voir resetAllMembers) :
       1. teams/{equipe}.members[].codeMatelot   -> liste de l'equipage
       2. teams/{equipe}/matelots/{code}         -> fiche detaillee
       3. matelots/{code}                        -> index global de reprise
     Les identifiants 2 et 3 sont le code lui-meme : changer un code veut
     donc dire DEPLACER ces documents, pas seulement modifier un champ.
     Oublier l'un des trois laisserait un code fantome utilisable. */
  async function adminChangeMatelotCode(teamCode, oldCode, newCode, memberData){
    /* Appelee a CHAQUE enregistrement, meme sans changement de code : elle
       sert aussi a propager un nouveau nom ou un nouveau service.
       Un ancien "if(oldCode === newCode) return;" bloquait justement ce
       cas, et laissait l'ancien nom dans la fiche et dans l'index. */

    // 2) fiche detaillee de l'equipe
    let fiche = { ...memberData, codeMatelot: newCode, teamCode };
    if(oldCode){
      const oldRef = doc(db,'teams',teamCode,'matelots',oldCode);
      const oldSnap = await getDoc(oldRef);
      /* On repart de l'ancienne fiche pour conserver ses champs annexes
         (date d'inscription...), MAIS memberData passe en dernier : les
         valeurs modifiees ecrasent bien les anciennes. */
      if(oldSnap.exists()) fiche = { ...oldSnap.data(), ...fiche };
      if(oldCode !== newCode) await deleteDoc(oldRef).catch(() => {});
    }
    if(newCode){
      await setDoc(doc(db,'teams',teamCode,'matelots',newCode), fiche);
    }
    // 3) index global (sert a la reconnexion par code)
    if(oldCode && oldCode !== newCode) await deleteDoc(doc(db,'matelots',oldCode)).catch(() => {});
    if(newCode){
      await setDoc(doc(db,'matelots',newCode), {
        codeMatelot: newCode,
        name: fiche.name || '',
        service: fiche.service || '',
        teamCode,
        teamName: fiche.teamName || '',
        updatedAt: new Date().toISOString()
      });
    }
  }

  async function adminMoveOrRenameMember(fromTeamCode, oldMemberKey, patch, toTeamCode, codeChange){
    if(!isAdminUnlocked()) return;
    try{
      const fromRef = doc(db,'teams',fromTeamCode);
      const fromSnap = await getDoc(fromRef);
      if(!fromSnap.exists()) throw new Error(`Équipe source ${fromTeamCode} introuvable.`);
      const fromTeam = { teamCode: fromTeamCode, ...fromSnap.data() };
      const member = (fromTeam.members || []).find(m => m.memberKey === oldMemberKey);
      if(!member) throw new Error('Membre introuvable dans l\'équipe source.');
      const newKey = memberKey(patch.name || member.name);
      const cc = codeChange || {};
      const finalCode = (cc.newCode !== undefined) ? cc.newCode : (member.codeMatelot || '');
      const updatedMember = {
        ...member,
        ...patch,
        name: (patch.name || member.name).toUpperCase(),
        memberKey: newKey,
        codeMatelot: finalCode,
        updatedAt: new Date().toISOString()
      };
      /* Nom de l'equipe de destination : il est ecrit dans la fiche et dans
         l'index global. L'ancienne version se rabattait sur le CODE de
         l'equipe quand elle changeait, ce qui inscrivait par exemple
         "NEDLAND" au lieu de "Ned Land". */
      let toTeamName = fromTeam.teamName || toTeamCode;

      if(fromTeamCode === toTeamCode){
        // Juste modifier
        const newMembers = fromTeam.members.map(m => m.memberKey === oldMemberKey ? updatedMember : m);
        await updateDoc(fromRef, { members: newMembers, updatedAt: new Date().toISOString() });
      }else{
        // Déplacer : retirer de from, ajouter à to
        const fromMembers = fromTeam.members.filter(m => m.memberKey !== oldMemberKey);
        await updateDoc(fromRef, { members: fromMembers, updatedAt: new Date().toISOString() });

        const toRef = doc(db,'teams',toTeamCode);
        const toSnap = await getDoc(toRef);
        if(!toSnap.exists()) throw new Error(`Équipe destination ${toTeamCode} introuvable.`);
        const toTeam = { teamCode: toTeamCode, ...toSnap.data() };
        toTeamName = toTeam.teamName || toTeamCode;
        // Vérifier collision de memberKey dans la destination
        const collision = (toTeam.members || []).find(m => m.memberKey === newKey);
        const toMembers = collision
          ? toTeam.members.map(m => m.memberKey === newKey ? updatedMember : m)
          : [...(toTeam.members || []), updatedMember];
        await updateDoc(toRef, { members: toMembers, updatedAt: new Date().toISOString() });
      }

      /* ===== PRÉSENCE + BLOCAGE PERSONNEL : ils suivent le matelot =====
         Ces deux états sont rangés par memberKey — clé dérivée du NOM.
         Renommer un matelot change donc sa clé. Sans cette migration :
           • son blocage personnel restait sous l'ancien nom (le matelot
             paraissait libre, alors que l'ancienne clé traînait « en
             surface » dans l'onglet Blocages) ;
           • sa présence « en plongée » restait collée à l'ancien nom
             dans le bloc ÉQUIPAGE ACTIF, et le matelot, lui, ne pouvait
             plus être reconnu comme l'auteur de sa propre partie.
         Déplacer un matelot laissait de même des traces dans l'équipe
         source. On reporte donc blocage et présence sur la nouvelle clé,
         et on nettoie l'ancienne — par chemin (jamais d'écrasement de
         l'état d'un coéquipier écrit au même instant). */
      const cleChangee = newKey !== oldMemberKey;
      const deplace = fromTeamCode !== toTeamCode;
      const lockSource = (fromTeam.matelotLocks || {})[oldMemberKey] || null;
      const presenceSource = (fromTeam.onlineMatelots || {})[oldMemberKey] || null;

      if (cleChangee || deplace) {
        const srcNettoyage = {};
        if (lockSource) srcNettoyage['matelotLocks.' + oldMemberKey] = deleteField();
        if (presenceSource) srcNettoyage['onlineMatelots.' + oldMemberKey] = deleteField();

        /* Le BLOCAGE suit le matelot (renommer ne doit ni le libérer ni
           l'oublier sous l'ancien nom). La PRÉSENCE, elle, est seulement
           retirée : si le matelot joue encore, son prochain battement la
           recréera sous le bon nom — on n'affiche ainsi jamais un matelot
           parti comme « encore en plongée » sous son nouveau nom. */
        const dstReport = {};
        if (lockSource) dstReport['matelotLocks.' + newKey] = { ...lockSource, name: updatedMember.name };

        const dstRef = doc(db, 'teams', toTeamCode);
        if (fromTeamCode === toTeamCode) {
          const patch = { ...srcNettoyage, ...dstReport };
          if (Object.keys(patch).length) await updateDoc(fromRef, patch);
        } else {
          if (Object.keys(srcNettoyage).length) await updateDoc(fromRef, srcNettoyage);
          if (Object.keys(dstReport).length) await updateDoc(dstRef, dstReport);
        }
      }

      /* Session en cours : si c'est CE matelot qui est aux commandes, on
         reporte son identité sur la nouvelle clé. Sans cela, après un
         renommage il redeviendrait simple spectateur de sa propre partie
         (ou se verrait refuser la prise de commandes). */
      if (fromTeamCode === toTeamCode && cleChangee) {
        try {
          const sessRef = doc(db, fromTeamCode, 'morseSession', 'current');
          const sessSnap = await getDoc(sessRef);
          if (sessSnap.exists()) {
            const sess = sessSnap.data();
            if (sess.startedByMemberKey === oldMemberKey) {
              await updateDoc(sessRef, {
                startedByMemberKey: newKey,
                startedByName: updatedMember.name
              });
            }
          }
        } catch (e) { /* session absente ou indisponible : sans gravité */ }
      }

      /* ===== SYNCHRONISATION DES 3 EMPLACEMENTS =====
     Un matelot existe a trois endroits, qui doivent TOUJOURS bouger
     ensemble (creation, modification, suppression) :
       1. teams/{equipe}.members[]            liste affichee
       2. teams/{equipe}/matelots/{code}      fiche detaillee
       3. matelots/{code}                     index de reconnexion
     Oublier le 3 laisse un code supprime encore valide pour se
     reconnecter. */
      const srcCode  = (cc.oldCode !== undefined) ? cc.oldCode : (member.codeMatelot || '');
      const teamChanged = fromTeamCode !== toTeamCode;

      // La fiche vit sous l'equipe : si l'equipe change, l'ancienne copie
      // doit disparaitre, sinon la reprise renverrait vers la mauvaise.
      if(teamChanged && srcCode){
        await deleteDoc(doc(db,'teams',fromTeamCode,'matelots',srcCode)).catch(() => {});
      }

      await adminChangeMatelotCode(
        toTeamCode,
        teamChanged ? '' : srcCode,   // deja supprimee juste au-dessus
        finalCode,
        {
          name: updatedMember.name,
          service: updatedMember.service,
          memberKey: newKey,
          teamName: toTeamName
        }
      );

      // L'ancien code ne doit plus permettre de se connecter.
      if(srcCode && srcCode !== finalCode){
        await deleteDoc(doc(db,'matelots',srcCode)).catch(() => {});
      }

      await renderAdminMembers();
      await loadTeams();
      endAdminSession(`✅ Membre ${updatedMember.name} mis à jour · session fermée`);
    }catch(err){
      console.error('adminMoveOrRenameMember:', err);
      alert(`❌ Échec modification : ${err.message || err}`);
    }
  }

  async function adminDeleteMember(teamCode, targetMemberKey){
    if(!isAdminUnlocked()) return;
    try{
      const ref = doc(db,'teams',teamCode);
      const snap = await getDoc(ref);
      if(!snap.exists()) throw new Error('Équipe introuvable.');
      const team = { teamCode, ...snap.data() };
      const victim = (team.members || []).find(m => m.memberKey === targetMemberKey);
      const newMembers = (team.members || []).filter(m => m.memberKey !== targetMemberKey);
      const patch = { members: newMembers, updatedAt: new Date().toISOString() };
      /* PRÉSENCE + BLOCAGE PERSONNEL : un matelot supprimé ne doit plus
         rester « en plongée » (onlineMatelots) ni « en surface »
         (matelotLocks) dans le bloc ÉQUIPAGE ACTIF ou l'onglet Blocages. */
      if (targetMemberKey) {
        patch['matelotLocks.' + targetMemberKey] = deleteField();
        patch['onlineMatelots.' + targetMemberKey] = deleteField();
      }
      await updateDoc(ref, patch);

      /* Purge des deux autres emplacements du matelot. Sans cela son Code
         Matelot restait valide : il pouvait se reconnecter alors qu'il
         venait d'etre supprime de l'equipage. */
      const code = victim?.codeMatelot;
      if(code){
        await deleteDoc(doc(db,'teams',teamCode,'matelots',code)).catch(() => {});
        await deleteDoc(doc(db,'matelots',code)).catch(() => {});
      }

      await renderAdminMembers();
      await loadTeams();
      endAdminSession(`✅ Membre supprimé · session fermée`);
    }catch(err){
      console.error('adminDeleteMember:', err);
      alert(`❌ Échec suppression : ${err.message || err}`);
    }
  }

  /* ---------- TAB : BLOCAGES ---------- */
  async function renderAdminLocks(){
    if(!isAdminUnlocked()) return;
    const box = $('adminLocksBox');
    if(!box) return;
    box.innerHTML = '<div class="small">Chargement…</div>';
    try{
      await refreshAdminTeams();
      const teams = [];
      for(const t of effectiveTeams){ const team = await getTeam(t.code); if(team) teams.push(team); }
      box.innerHTML = teams.map(t => {
        /* PLUS DE BLOCAGE D'EQUIPE ENTIERE.
           Le jeu ne bloque plus que le matelot fautif. Le reglage manuel
           qui subsistait ici etait le dernier moyen de punir tout un
           equipage : il contredisait la regle et n'avait plus lieu
           d'etre. Cet onglet ne gere donc que les blocages PERSONNELS,
           avec le compteur d'echecs pour information. */
        return `<div class="team" data-team="${esc(t.teamCode)}">
          <h3>${esc(t.teamName)} <span class="small" style="color:#9bc4d4">(${esc(t.teamCode)})</span></h3>
          <div class="small" style="margin-bottom:10px">Échecs cumulés de l'équipage : <b>${Number(t.failCount||0)}</b></div>
          ${renderMatelotLocksHtml(t)}
        </div>`;
      }).join('');
      box.querySelectorAll('.team').forEach(teamEl => {
        const code = teamEl.dataset.team;
        teamEl.querySelectorAll('.lk-free-one').forEach(b =>
          b.addEventListener('click', () => adminUnlockMatelot(code, b.dataset.key)));
        teamEl.querySelector('.lk-free-all')?.addEventListener('click', () => adminUnlockMatelot(code, null));
      });
    }catch(err){
      console.error('renderAdminLocks:', err);
      box.innerHTML = `<div class="notice warning">Erreur : ${esc(err.message || err)}</div>`;
    }
  }

  function cleJour(d) {
    var date = d ? (d instanceof Date ? d : new Date(d)) : new Date();
    if (isNaN(date.getTime())) date = new Date();
    try {
      return date.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
    } catch (e) {
      var y = date.getFullYear();
      var m = String(date.getMonth() + 1).padStart(2, '0');
      var day = String(date.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    }
  }
  function estAujourdhui(dateStr) {
    if (!dateStr) return false;
    try {
      return cleJour(dateStr) === cleJour();
    } catch (e) {
      return false;
    }
  }
  function echecsDuJour(l) {
    if (!l) return 0;
    if (l.lastFailDay) {
      return l.lastFailDay === cleJour() ? Number(l.failCount || 0) : 0;
    }
    if (l.blockedAt) {
      return estAujourdhui(l.blockedAt) ? Number(l.failCount || 0) : 0;
    }
    return 0;
  }

  /* Liste des matelots actuellement en surface (blocage personnel).
     Sans cet affichage, un blocage individuel serait invisible depuis
     l'admin : impossible de savoir qui est bloque, ni de le liberer. */
  function renderMatelotLocksHtml(t){
    const locks = t.matelotLocks || {};
    const now = Date.now();
    const actifs = Object.entries(locks)
      .filter(([,l]) => l && l.lockedUntil && new Date(l.lockedUntil).getTime() > now);
    if(!actifs.length){
      return '<div class="small" style="margin-bottom:10px;color:#5be09b">Aucun matelot bloqué individuellement.</div>';
    }
    const lignes = actifs.map(([key, l]) => {
      const echecsAuj = echecsDuJour(l);
      const dureeTxt = l.lastLockHours ? ` · ${l.lastLockHours} h` : '';
      return `<li style="margin:4px 0">🔒 <b>${esc(l.name || key)}</b> — jusqu'au ${esc(formatDate(l.lockedUntil))}
        (${esc(String(echecsAuj || l.failCount || 1))} échec(s) aujourd'hui${dureeTxt})
        <button class="secondary lk-free-one" type="button" data-key="${esc(key)}" style="margin-left:8px;padding:3px 10px;font-size:12px">Libérer</button></li>`;
    }).join('');
    return `<div class="small" style="margin-bottom:10px">
        <b>Matelots en surface (${actifs.length})</b>
        <ul style="margin:6px 0 8px 0;padding-left:18px">${lignes}</ul>
        <button class="secondary lk-free-all" type="button" style="padding:4px 12px;font-size:12px">🔓 Libérer tous les matelots</button>
      </div>`;
  }

  /* Leve un blocage personnel (un matelot, ou tous si key vaut null). */
  async function adminUnlockMatelot(teamCode, key){
    if(!isAdminUnlocked()) return;
    try{
      const ref = doc(db,'teams',teamCode);
      const snap = await getDoc(ref);
      if(!snap.exists()) throw new Error('Équipe introuvable.');
      const locks = { ...(snap.data().matelotLocks || {}) };
      if(key){ delete locks[key]; } else { Object.keys(locks).forEach(k => delete locks[k]); }
      await updateDoc(ref, { matelotLocks: locks, updatedAt:new Date().toISOString() });
      if(currentTeam?.teamCode === teamCode){
        currentTeam = { ...currentTeam, matelotLocks: locks };
        renderGame();
      }
      await renderAdminLocks();
      endAdminSession(key ? '✅ Matelot libéré · session fermée' : '✅ Tous les matelots libérés · session fermée');
    }catch(err){
      console.error('adminUnlockMatelot:', err);
      alert(`❌ Échec : ${err.message || err}`);
    }
  }



  /* ---------- TAB : O2 ---------- */
  function renderAdminOxygen(){
    if(!isAdminUnlocked()) return;
    const startedAt = missionConfig?.missionStartedAt;
    const now = Date.now();
    if(!startedAt){
      $('adminO2Now').textContent = 'Non démarrée';
      $('adminO2State').textContent = 'EN ATTENTE';
      $('adminO2State').className = 'admin-o2-badge';
      $('adminO2Countdown').textContent = formatCountdown(getMissionDurationMs());
      const durMs = getMissionDurationMs();
      $('adminO2Days').value = Math.floor(durMs / 86400000);
      $('adminO2Hours').value = Math.floor((durMs % 86400000) / 3600000);
      return;
    }
    const start = new Date(startedAt);
    const durationMs = getMissionDurationMs();
    const end = start.getTime() + durationMs;
    let diff = Math.max(0, end - now);
    const percent = Math.max(0, Math.min(100, Math.round((diff / durationMs) * 100)));
    const d = Math.floor(diff / 86400000); diff -= d * 86400000;
    const h = Math.floor(diff / 3600000); diff -= h * 3600000;
    const m = Math.floor(diff / 60000); diff -= m * 60000;
    const sec = Math.floor(diff / 1000);
    $('adminO2Now').textContent = percent + '%';
    $('adminO2Countdown').textContent = `${d}J ${String(h).padStart(2,'0')}h${String(m).padStart(2,'0')}m${String(sec).padStart(2,'0')}s`;
    $('adminO2State').textContent = percent <= 20 ? 'CRITIQUE' : (percent <= 50 ? 'EN BAISSE' : 'STABLE');
    $('adminO2State').className = 'admin-o2-badge' + (percent <= 20 ? ' critical' : (percent <= 50 ? ' warning' : ''));
    // Durée restante déduite
    const totalRemainingDays = (end - now) / 86400000;
    $('adminO2Days').value = Math.max(0, Math.floor(totalRemainingDays));
    $('adminO2Hours').value = Math.max(0, Math.floor((totalRemainingDays - $('adminO2Days').value) * 24));
  }
  async function adminApplyOxygen(){
    if(!isAdminUnlocked()) return;
    try{
      const days = Math.max(0, Number($('adminO2Days').value || 0));
      const hours = Math.max(0, Math.min(23, Number($('adminO2Hours').value || 0)));
      // On stocke une override `missionDurationMs` dans game/config.
      const durationMs = ((days * 24) + hours) * 60 * 60 * 1000;
      /* Appliquer une durée NE DÉMARRE PAS le compte à rebours : on laisse
         missionStartedAt à null. Le « top départ » viendra du lancement du
         mini-jeu du Palier 1, pas du panneau admin. */
      await setDoc(doc(db,'game','config'), {
        missionStartedAt: null,
        missionDurationMs: durationMs,
        updatedAt: new Date().toISOString()
      }, {merge:true});
      missionConfig = { ...(missionConfig||{}), missionStartedAt: null, missionDurationMs: durationMs };
      updateCountdown();
      renderAdminOxygen();
      endAdminSession(`✅ Réserve O₂ armée à ${formatInitialDuration(durationMs)} — en attente du top départ · session fermée`);
    }catch(err){
      console.error('adminApplyOxygen:', err);
      alert(`❌ Échec : ${err.message || err}`);
    }
  }
  async function adminResetOxygenToNow(){
    if(!isAdminUnlocked()) return;
    /* Rétablit la durée d'origine (7 jours) ET remet la mission en attente :
       le compte à rebours ne démarre PAS ici — il partira au « top départ »,
       quand le premier matelot lancera le mini-jeu du Palier 1
       (startMissionOfficial). Aucun bouton du panneau ne doit l'armer. */
    const durationMs = MISSION_DURATION_MS_DEFAULT;
    await setDoc(doc(db,'game','config'), {
      missionStartedAt: null,
      missionDurationMs: durationMs,
      updatedAt: new Date().toISOString()
    }, {merge:true});
    missionConfig = { ...(missionConfig||{}), missionStartedAt: null, missionDurationMs: durationMs };
    updateCountdown();
    renderAdminOxygen();
    endAdminSession(`✅ Réserve O₂ réarmée à ${formatInitialDuration(durationMs)} — en attente du top départ · session fermée`);
  }
  async function adminClearOxygen(){
    if(!isAdminUnlocked()) return;
    if(!confirm('Arrêter la mission (clear du compteur O₂) ?')) return;
    await setDoc(doc(db,'game','config'), {
      missionStartedAt: null,
      missionDurationMs: null,
      updatedAt: new Date().toISOString()
    }, {merge:true});
    missionConfig = { ...(missionConfig||{}), missionStartedAt: null, missionDurationMs: null };
    updateCountdown();
    renderAdminOxygen();
    endAdminSession('✅ Mission arrêtée (O₂ cleared) · session fermée');
  }
  $('adminO2Apply')?.addEventListener('click', adminApplyOxygen);
  $('adminO2Reset')?.addEventListener('click', adminResetOxygenToNow);
  $('adminO2Clear')?.addEventListener('click', adminClearOxygen);

  /* Remplit les listes deroulantes du formulaire d'ajout manuel. */
  function fillAddMemberSelects(){
    const svc = $('adminNewMemberSvc');
    const team = $('adminNewMemberTeam');
    if(svc){
      svc.innerHTML = '<option value="" selected disabled>Ex. PE</option>'
        + SERVICES.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
    }
    if(team){
      team.innerHTML = '<option value="" selected disabled>Choisir…</option>'
        + effectiveTeams.map(t => `<option value="${esc(t.code)}">${esc(t.name)}</option>`).join('');
    }
  }

  /* Ajout manuel d'un matelot par l'admin.
     Ecrit aux 3 memes emplacements que l'inscription joueur :
       teams/{code}.members[] , teams/{code}/matelots/{code} , matelots/{code}
     et applique les memes controles (nom obligatoire, pas d'homonyme). */
  async function adminAddMember(){
    if(!isAdminUnlocked()) return;
    const btn = $('adminAddMemberBtn');
    const name = ($('adminNewMemberName').value || '').trim().toUpperCase();
    const service = $('adminNewMemberSvc').value;
    const teamCode = $('adminNewMemberTeam').value;
    const msg = $('adminAddMemberMsg');

    const manque = [];
    if(!name) manque.push('le nom');
    if(!service) manque.push('le service');
    if(!teamCode) manque.push("l'équipage");
    if(manque.length){ alert('Il manque ' + manque.join(', ') + '.'); return; }
    if(name.length < 2){ alert('Nom trop court.'); return; }

    btn.disabled = true;
    try{
      const teamRef = doc(db,'teams',teamCode);
      const teamSnap = await getDoc(teamRef);
      if(!teamSnap.exists()){ alert("Cette équipe n'existe plus. Recharge le panneau."); return; }

      // Codes et noms deja pris, sur TOUTES les equipes
      const allSnap = await getDocs(collection(db,'teams'));
      const usedCodes = new Set();
      const usedNames = new Map();
      allSnap.forEach(d => {
        const data = d.data();
        (data.members || []).forEach(m => {
          if(m.codeMatelot) usedCodes.add(m.codeMatelot);
          const k = m.memberKey || memberKey(m.name || '');
          if(k) usedNames.set(k, { name: m.name || '', team: data.teamName || d.id });
        });
      });
      /* Cote admin, pas de session a fermer : on refuse simplement.
         Message aligne sur celui de l'embarquement, mais l'admin a besoin
         de savoir DANS QUELLE equipe le nom est deja pris. */
      const dup = usedNames.get(memberKey(name));
      if(dup){
        alert('⚓ Ce nom figure déjà au registre (' + dup.team + ').\n\n'
          + 'Ajoute un prénom ou une initiale pour le distinguer.');
        return;
      }

      let matelotCode, attempts = 0;
      do { matelotCode = generateMatelotCode(); attempts++; if(!usedCodes.has(matelotCode)) break; } while(attempts < 50);

      const teamName = teamSnap.data().teamName || teamCode;
      const registeredAt = new Date().toISOString();
      const matelotDoc = {
        name, service, memberKey: memberKey(name), codeMatelot: matelotCode,
        teamCode, teamName, registeredAt
      };
      await setDoc(doc(db,'teams',teamCode,'matelots',matelotCode), matelotDoc);
      const members = [...(teamSnap.data().members || []),
        { name, service, memberKey: memberKey(name), codeMatelot: matelotCode, registeredAt }];
      await updateDoc(teamRef, { members, updatedAt: registeredAt });
      await setDoc(doc(db,'matelots',matelotCode), {
        codeMatelot: matelotCode, teamCode, teamName, name, service, createdAt: serverTimestamp()
      });

      // Le code n'est affiche qu'ici : l'admin doit le transmettre.
      msg.innerHTML = '<div class="notice success" style="margin:0">'
        + '<b>' + esc(name) + '</b> ajouté à <b>' + esc(teamName) + '</b>.<br>'
        + 'Code Matelot : <span class="code uppercase">' + esc(matelotCode) + '</span>'
        + '<div class="small" style="margin-top:6px">Clique sur le code pour le copier, puis transmets-le au matelot.</div>'
        + '</div>';
      $('adminNewMemberName').value = '';
      $('adminNewMemberSvc').value = '';
      $('adminNewMemberTeam').value = '';
      await renderAdminMembers();
      await loadTeams();
    }catch(err){
      console.error('adminAddMember:', err);
      alert('Échec de l\'ajout : ' + (err.message || err));
    }finally{
      btn.disabled = false;
    }
  }
  $('adminAddMemberBtn')?.addEventListener('click', adminAddMember);

  /* ---------- TAB : ÉQUIPES ---------- */
  async function renderAdminTeams(){
    if(!isAdminUnlocked()) return;
    const box = $('adminTeamsBox');
    if(!box) return;
    box.innerHTML = '<div class="small">Chargement…</div>';
    try{
      await refreshAdminTeams();
      if(!effectiveTeams.length){
        box.innerHTML = '<div class="notice warning">Aucune équipe dans Firestore.<br><span class="small">Recharge la page : les équipes par défaut seront recréées (sauf celles marquées comme supprimées).</span></div>';
        return;
      }
      box.innerHTML = effectiveTeams.map(t => {
        const isCustom = !TEAM_DEFS.some(d => d.code === t.code);
        return `<div class="team" data-team="${esc(t.code)}">
          <h3>${esc(t.name)}${isCustom ? ' <span class="small" style="color:#5be09b">[custom]</span>' : ''}</h3>
          <div class="hr"></div>
          <div class="team-edit-row">
            <input type="text" class="tt-name" value="${esc(t.name)}" maxlength="32" placeholder="Nom de l'équipe">
            <div class="tt-actions">
              <button class="primary mini tt-save" type="button" style="background:var(--fnac);color:#111">💾 Renommer</button>
              <button class="danger mini tt-del" type="button">🗑</button>
            </div>
          </div>
          ${Number(t.memberCount) > 0
            ? `<div class="small" style="color:#ff8579;margin-top:6px;font-weight:800">⚠️ ${t.memberCount} matelot(s) à bord — les supprimer effacera aussi leurs Codes Matelot</div>`
            : '<div class="small" style="color:#9bc4d4;margin-top:6px">Aucun matelot à bord</div>'}
        </div>`;
      }).join('');
      box.querySelectorAll('.team').forEach(teamEl => {
        const code = teamEl.dataset.team;
        const isDefault = TEAM_DEFS.some(d => d.code === code);
        const teamLabel = (effectiveTeams.find(x => x.code === code) || {}).name || code;
        teamEl.querySelector('.tt-save').addEventListener('click', async () => {
          const newName = teamEl.querySelector('.tt-name').value.trim();
          if(!newName){ alert('Nom requis.'); return; }
          await adminRenameTeam(code, newName);
        });
        teamEl.querySelector('.tt-del').addEventListener('click', async () => {
          if(isDefault){
            if(!confirm(`⚠️ Supprimer l'équipe ${teamLabel} ?\n\n• Toute sa progression est perdue\n• Ses matelots sont supprimés (leurs codes ne fonctionneront plus)\n• Elle ne sera plus proposée à l'inscription\n• Pour confirmer, il faudra retaper "${teamLabel}" dans la fenêtre suivante.`)) return;
          }else{
            if(!confirm(`Supprimer définitivement l'équipe ${teamLabel} ?\n\n• Toute sa progression est perdue\n• Ses matelots sont supprimés`)) return;
          }
          await adminDeleteTeam(code, isDefault);
        });
      });
    }catch(err){
      console.error('renderAdminTeams:', err);
      box.innerHTML = `<div class="notice warning">Erreur : ${esc(err.message || err)}</div>`;
    }
  }
  async function adminRenameTeam(code, newName){
    if(!isAdminUnlocked()) return;
    try{
      await updateDoc(doc(db,'teams',code), { teamName: newName, updatedAt: new Date().toISOString() });
      // Les equipes custom sont listees dans game/config : sans cette mise a
      // jour, l'ancien nom reapparaissait au rechargement.
      const cfgRef = doc(db,'game','config');
      const cfgSnap = await getDoc(cfgRef);
      const cfg = cfgSnap.exists() ? cfgSnap.data() : {};
      const customs = Array.isArray(cfg.customTeams) ? cfg.customTeams : [];
      const idx = customs.findIndex(t => t.code === code);
      if(idx >= 0){
        customs[idx] = { ...customs[idx], name: newName };
        await setDoc(cfgRef, { customTeams: customs, updatedAt: new Date().toISOString() }, { merge: true });
      }
      invalidateTeamsCache();
      await refreshAdminTeams();
      await renderAdminTeams();
      await loadTeams();
      endAdminSession(`✅ Équipe renommée en "${newName}" · session fermée`);
    }catch(err){
      console.error('adminRenameTeam:', err);
      alert(`❌ Échec renommage : ${err.message || err}`);
    }
  }
  async function adminAddTeam(){
    if(!isAdminUnlocked()) return;
    const name = ($('adminNewTeamName').value || '').trim();
    if(!name){ alert('Nom de l\'équipe requis.'); return; }
    // L'identifiant est derive du nom (accents et espaces retires).
    const codeRaw = simple(name).replace(/[^A-Z0-9]/g, '');
    if(codeRaw.length < 3){ alert('Nom trop court : 3 caractères minimum.'); return; }
    if(codeRaw.length > 24){ alert('Nom trop long : 24 caractères maximum.'); return; }
    try{
      // On verifie l'existence dans Firestore, pas sur une liste en memoire
      // qui pourrait dater (equipe creee depuis un autre appareil).
      const dup = await getDoc(doc(db,'teams',codeRaw));
      if(dup.exists()){ alert('Cette équipe existe déjà.'); return; }
      // 1) créer le doc team
      await setDoc(doc(db,'teams',codeRaw), {
        teamCode: codeRaw, teamName: name,
        currentStep:'start', status:'active', lockedUntil:null,
        failCount:0, lastLockHours:0, completedSteps:[],
        members:[], onlinePlayers:{},
        createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()
      });
      // 2) persister dans customTeams (game/config)
      const cfgRef = doc(db,'game','config');
      const cfgSnap = await getDoc(cfgRef);
      const cfg = cfgSnap.exists() ? cfgSnap.data() : {};
      const customs = Array.isArray(cfg.customTeams) ? cfg.customTeams : [];
      if(!customs.some(t => t.code === codeRaw)){
        customs.push({ code: codeRaw, name });
      }
      // Si cette equipe avait ete supprimee, on retire la marque "obsolete" :
      // sans cela, ensureTeams() la supprimerait de nouveau au rechargement.
      const obsolete = (Array.isArray(cfg.obsoleteTeams) ? cfg.obsoleteTeams : [])
        .filter(c => c !== codeRaw);
      await setDoc(cfgRef, { customTeams: customs, obsoleteTeams: obsolete, updatedAt:new Date().toISOString() }, {merge:true});
      $('adminNewTeamName').value = '';
      invalidateTeamsCache();
      await refreshAdminTeams();
      await renderAdminTeams();
      await loadTeams();
      endAdminSession(`✅ Équipe ${name} créée · session fermée`);
    }catch(err){
      console.error('adminAddTeam:', err);
      alert(`❌ Échec création : ${err.message || err}`);
    }
  }
  async function adminDeleteTeam(code, isDefault){
    if(!isAdminUnlocked()) return;
    const label = (effectiveTeams.find(x => x.code === code) || {}).name || code;
    try{
      // Confirmation supplémentaire pour une équipe par défaut
      if(isDefault){
        const typed = prompt(`⚠️ Tu supprimes l'équipe ${label}.\n\nPour confirmer, retape son nom exactement :`);
        if(simple(typed || '') !== simple(label)){ alert('Confirmation annulée.'); return; }
      }
      // Purge des matelots (sous-collection + index global) AVANT le doc equipe,
      // sinon les Codes Matelot restent valides et pointent vers une equipe fantome.
      const matelotsSnap = await getDocs(collection(db,'teams',code,'matelots'));
      for(const d of matelotsSnap.docs){
        await deleteDoc(doc(db,'matelots', d.data().codeMatelot || d.id)).catch(() => {});
        await deleteDoc(d.ref).catch(() => {});
      }
      const teamSnap = await getDoc(doc(db,'teams',code));
      if(teamSnap.exists()){
        for(const m of (teamSnap.data().members || [])){
          if(m.codeMatelot) await deleteDoc(doc(db,'matelots',m.codeMatelot)).catch(() => {});
        }
      }
      await deleteDoc(doc(db,'teams',code));
      // Config : retirer des customTeams et ajouter aux obsolètes
      const cfgRef = doc(db,'game','config');
      const cfgSnap = await getDoc(cfgRef);
      const cfg = cfgSnap.exists() ? cfgSnap.data() : {};
      const customs = (cfg.customTeams || []).filter(t => t.code !== code);
      const obsolete = Array.isArray(cfg.obsoleteTeams) ? cfg.obsoleteTeams : [];
      if(!obsolete.includes(code)) obsolete.push(code);
      await setDoc(cfgRef, { customTeams: customs, obsoleteTeams: obsolete, updatedAt:new Date().toISOString() }, {merge:true});
      invalidateTeamsCache();
      await refreshAdminTeams();
      await renderAdminTeams();
      await renderAdminMembers();
      await loadTeams();
      endAdminSession(`✅ Équipe ${label} supprimée · session fermée`);
    }catch(err){
      console.error('adminDeleteTeam:', err);
      alert(`❌ Échec suppression : ${err.message || err}`);
    }
  }
  async function adminPurgePwa(e){
    const btn = e && e.target ? e.target : $('adminPurgePwaBtn');
    if(!confirm("⚠️ Forcer la dernière version en vidant le cache PWA de cet appareil ?\n\nLe cache local et le Service Worker seront purgés, puis la page rechargera avec la version la plus récente.")) return;
    const oldText = btn ? btn.textContent : '';
    if(btn) btn.textContent = 'Purge…';
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
      }
      location.href = location.pathname + '?_fresh=' + Date.now();
    } catch(err) {
      alert('Erreur lors de la purge : ' + (err.message || err));
      if(btn) btn.textContent = oldText;
    }
  }

  $('adminAddTeamBtn')?.addEventListener('click', adminAddTeam);
  // Liaisons des commandes sensibles (côté index elles vivent dans le script
  // principal de la page ; ici on les câble pour les pages injectées).
  $('adminQuickTestAnnonceBtn')?.addEventListener('click', testerAnnonceVerte);
  $('resetAllMembersBtn')?.addEventListener('click', resetAllMembers);
  $('adminDesignerBtn')?.addEventListener('click', renderDesignerAccess);
  $('resetAllProgressBtn')?.addEventListener('click', resetAllProgress);
  $('cleanupTestSessionsBtn')?.addEventListener('click', cleanupTestSessions);
  $('adminPurgePwaBtn')?.addEventListener('click', adminPurgePwa);

  return { open: openAdminPanel, close: closeAdminPanel };

  }

  /* ===== Initialisation par page ===== */
  function init(){
    const isIndex = !!document.getElementById('adminFabBtn');
    if(isIndex){
      if(new URLSearchParams(location.search).get('admin') === '1'){
        setTimeout(() => document.getElementById('adminFabBtn')?.click(), 700);
      }
      return;
    }
    if(document.getElementById('adminFabBtn') || document.getElementById('nautilusAdminShortcut')) return;
    injectAdminPanel();
    const admin = mountAdminLogic();

    const footer = document.createElement('footer');
    footer.className = 'site-footer nautilus-admin-footer';
    footer.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:11000;margin:0;padding:0;display:flex;align-items:center;';
    footer.innerHTML = '<button id="adminFabBtn" type="button" aria-label="Maintenance" title="Maintenance"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></button>';
    document.body.appendChild(footer);

    const gear = document.getElementById('adminFabBtn');
    if(gear){
      gear.addEventListener('click', () => {
        const p = document.getElementById('adminPanel');
        if(!p) return;
        if(p.classList.contains('open')) admin.close();
        else admin.open();
      });
    }

    // Alias pour compatibilité
    const shortcut = document.createElement('span');
    shortcut.id = 'nautilusAdminShortcut';
    shortcut.style.display = 'none';
    shortcut.addEventListener('click', () => {
      const p = document.getElementById('adminPanel');
      if(!p) return;
      if(p.classList.contains('open')) admin.close();
      else admin.open();
    });
    document.body.appendChild(shortcut);

    document.getElementById('adminPanel')?.addEventListener('click', e => {
      if(e.target === document.getElementById('adminPanel')) admin.close();
    });
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape') admin.close();
    });

    if(new URLSearchParams(location.search).get('admin') === '1'){
      setTimeout(() => gear?.click(), 700);
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
