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
     animé 🧭, titre « CAP SUR LE QR CODE : « … » » (qui NOTIFIE la
     zone de recherche du QR), trois étapes-chips (rallier la zone /
     passer au prochain palier / scanner le QR trouvé), gros bouton
     ⏭️ « PASSER AU PROCHAIN PALIER » PULSANT et une unique ligne
     d'astuce 📷 (photo du QR = clé d'entrée).

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
     radar sonar, cap, indication, 3 étapes-chips, CTA pulsant, astuce.
     Contenu VOLONTAIREMENT court (chips de 3-4 mots, 1 ligne d'astuce).
     Mêmes classes/markup que directionPanelHtml() de palier1.html. */
  function directionHtml(o) {
    var boutonTexte = (o.labelSuivant === 'Palier final')
      ? 'PASSER AU PALIER FINAL'
      : 'PASSER AU PALIER ' + (Number(o.palier) + 1);
    var prochain = o.labelSuivant || ('Palier ' + (Number(o.palier) + 1));
    return ''
      + '<div class="won-nextzone" id="wonDirectionPanel">'
      +   '<div class="won-radar" aria-hidden="true">'
      +     '<span class="won-radar-ring"></span>'
      +     '<span class="won-radar-ring won-radar-ring--2"></span>'
      +     '<span class="won-radar-core">🧭</span>'
      +   '</div>'
      +   '<h3 class="won-nextzone-title">CAP SUR LE QR CODE</h3>'
      +   '<div class="won-nextzone-steps">'
      +     '<span class="won-step-chip"><b>1</b> Rallier la Zone de recherche</span>'
      +     '<span class="won-step-chip"><b>2</b> Passer au prochain palier</span>'
      +     '<span class="won-step-chip"><b>3</b> Scanner le QR Code trouvé</span>'
      +   '</div>'
      +   '<a class="won-next-btn" href="' + esc(o.urlSuivante) + '">⏭️ ' + esc(boutonTexte) + '</a>'
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
    /* Équipage nommé → « Tout l'équipage « Nautilus » franchit… » ;
       anonyme/test → « L'équipage franchit… » (pas de « l'équipage »
       entre guillemets, pléonasme). */
    var ligneEquipage = o.equipe
      ? 'Tout l’équipage « ' + esc(o.equipe) + ' » franchit le sas du <b>Palier ' + esc(o.palier) + '</b>.'
      : 'L’équipage franchit le sas du <b>Palier ' + esc(o.palier) + '</b>.';
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
      +   '<p class="won-line won-line--bravo">Bravo à <b>' + esc(bravo) + '</b> pour « ' + esc(o.mission) + ' ».</p>'
      +   '<div class="won-stats" aria-label="Bilan de l’épreuve">' + statsHtml + '</div>'
      +   '<div class="won-records" id="wonRecordsHost" aria-live="polite"></div>'
      +   '<div class="won-unlock-note">🔓 Sas franchi : les blocages sont levés —'
      +   ' tout l’équipage replonge !</div>'
      +   directionHtml(o)
      + '</div>';
  }

  window.NautilusVictoire = { afficher: afficher };
})();
