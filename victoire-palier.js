/* =============================================================
   ÉCRAN DE VICTOIRE DES PALIERS — CODE COMMUN À TOUS LES PALIERS ≥ 2
   (victoire-palier.js)

   LA MÊME PAGE DE VICTOIRE QUE LE PALIER 1, PARTOUT : badge 🏆,
   « Épreuve validée ! », ligne d'équipage, bravo au matelot, 3 stats
   (temps, mots, erreurs) — PUIS, refonte v3 (demande capitaine : plus
   SPECTACULAIRE et IMMERSIF, textes COURTS, aucun bouton superflu) :

     dès la note « 🔓 … », l'ancien panneau PLIABLE « DIRECTION VERS LA
     ZONE DE RECHERCHE » (longs paragraphes + bouton 🧭 CONTINUER qui
     ne faisait que plier/déplier — doublon du vrai CTA) est remplacé
     par un bloc « PROCHAINE IMMERSION » toujours visible : radar sonar
     animé 🧭, titre « CAP SUR LE QR CODE » — DEUX encarts : « Rallier
     la Zone de recherche » + le descriptif de la zone, puis « Passer
     au prochain palier » + bouton « 📷 Scanner le QR Code trouvé » —
     et une unique ligne d'astuce 📷 (photo du QR = clé d'entrée).

   Structure et classes (.won-* — styles dans css/palier1.css, chargée
   par TOUTES les pages de palier) calquées sur renderWonScreen() /
   directionPanelHtml() de palier1.html — À GARDER EN PHASE avec eux.

   Chaque page de palier appelle, au moment de sa victoire :

     window.NautilusVictoire.afficher(hote, {
       palier: 2,                    // numéro du palier franchi
       mission: 'Code Magasin',      // nom de l'épreuve (« … »)
       equipe: 'Nemo'  | null,       // équipage (null → « l'équipage »)
       bravo:  'Alice' | null,       // matelot à l'honneur
       stats: [ { valeur: '04:32', label: 'Temps utilisé' },
                { valeur: '10/10', label: 'Mots validés' },
                { valeur: '2',     label: 'Erreurs' } ],
       indication: '…',              // indication de direction du QR
       labelSuivant: 'Palier 3',
       urlSuivante: '1831411720.html'
     });

   AUCUNE dépendance, AUCUN réseau : on fournit les textes, le module
   fait la fête.
   ============================================================= */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Bloc « PROCHAINE IMMERSION » — remplace l'ancien panneau pliable :
     radar sonar, cap, indication, DEUX encarts (Rallier la zone +
     descriptif / Passer au palier + bouton « Scanner le QR Code trouvé »),
     CTA pulsant, astuce. Contenu VOLONTAIREMENT court.
     Mêmes classes/markup que directionPanelHtml() de palier1.html. */
  function directionHtml(o) {
    var prochain = (o.labelSuivant === 'Palier final')
      ? 'Palier final'
      : 'Palier « ' + (Number(o.palier) + 1) + ' »';
    var indication = o.indication || '…… (en attente d’indication par l’admin)';
    return ''
      + '<div class="won-nextzone" id="wonDirectionPanel">'
      +   '<div class="won-radar" aria-hidden="true">'
      +     '<span class="won-radar-ring"></span>'
      +     '<span class="won-radar-ring won-radar-ring--2"></span>'
      +     '<span class="won-radar-core">🧭</span>'
      +   '</div>'
      +   '<h3 class="won-nextzone-title">CAP SUR LE QR CODE</h3>'
      +   '<div class="won-zone-steps">'
      +     '<div class="won-zone-panel">'
      +       '<div class="won-zone-head"><span class="won-zone-num">1</span><span class="won-zone-title">Rallier la Zone de recherche</span></div>'
      +       '<p class="won-zone-desc">📍 « ' + esc(indication) + ' »</p>'
      +     '</div>'
      +     '<div class="won-zone-panel">'
      +       '<div class="won-zone-head"><span class="won-zone-num">2</span><span class="won-zone-title">Passer au prochain palier</span></div>'
      +       '<a class="won-next-btn won-zone-btn" href="' + esc(o.urlSuivante) + '?scan=1">📷 Scanner le QR Code trouvé</a>'
      +     '</div>'
      +   '</div>'
      +   '<p class="won-nextzone-hint">📷 Envie de faire une pause ? Pensez à photographier le QR de la zone : c’est la clé d’entrée du ' + esc(prochain) + '.</p>'
      + '</div>';
  }

  /* Écran « Épreuve validée ! » — miroir de renderWonScreen() du
     Palier 1 (phrase d'accueil FIGÉE, comme là-bas : pas de re-pop à
     chaque rafraîchissement). Note de déblocage réduite à UNE ligne ;
     plus AUCUN bouton plier/déplier (superflu) : le bloc de direction
     est affiché en permanence. */
  function afficher(hote, opts) {
    if (!hote) return;
    var o = opts || {};
    /* Équipage nommé → « Tout l'équipage <em>Nautilus</em> franchit… » ;
       anonyme/test → « L'équipage franchit… » (pas de nom d'équipage,
       pléonasme). */
    var ligneEquipage = o.equipe
      ? 'Tout l’équipage <em>' + esc(o.equipe) + '</em> franchit le sas du <b><em>Palier ' + esc(o.palier) + '</em></b>.'
      : 'L’équipage franchit le sas du <b><em>Palier ' + esc(o.palier) + '</em></b>.';
    var bravo = o.bravo || 'l’équipage';
    var stats = (o.stats || []).slice(0, 4);
    var statsHtml = stats.map(function (s) {
      return '<div class="won-stat"><strong>' + esc(s.valeur) + '</strong><span>' + esc(s.label) + '</span></div>';
    }).join('');
    hote.innerHTML = ''
      + '<div class="won-screen celebration">'
      +   '<div class="won-badge" aria-hidden="true">🏆</div>'
      +   '<h2>Épreuve validée !</h2>'
      +   '<p class="won-line">' + ligneEquipage + '</p>'
      +   '<p class="won-line won-line--bravo">Bravo à <b><em>' + esc(bravo) + '</em></b> pour « ' + esc(o.mission) + ' ».</p>'
      +   '<div class="won-stats" aria-label="Bilan de l’épreuve">' + statsHtml + '</div>'
      +   '<div class="won-records" id="wonRecordsHost" aria-live="polite"></div>'
      +   '<div class="won-unlock-note">🔓 Sas franchi : les blocages sont levés —'
      +   ' tout l’équipage replonge !</div>'
      +   directionHtml(o)
      + '</div>';
  }

  window.NautilusVictoire = { afficher: afficher };
})();
