/* =============================================================
   ÉCRAN DE VICTOIRE DES PALIERS — CODE COMMUN À TOUS LES PALIERS ≥ 2
   (victoire-palier.js)

   LA MÊME PAGE DE VICTOIRE QUE LE PALIER 1, PARTOUT : badge 🏆,
   « Épreuve validée ! », ligne d'équipage, bravo au matelot, 3 stats
   (temps, mots, erreurs), note de déblocage, bouton 🧭 CONTINUER et
   panneau PLIABLE « DIRECTION VERS LA ZONE DE RECHERCHE » qui mène au
   sas du palier suivant. Structure et classes (.won-* — styles dans
   css/palier1.css, chargée par TOUTES les pages de palier) calquées
   sur renderWonScreen() / directionPanelHtml() de palier1.html.

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
       actionSuivante: 'PASSER AU 3EME PALIER',
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

  /* Panneau « DIRECTION VERS LA ZONE DE RECHERCHE » — mêmes classes et
     même contenu type que palier1.html#directionPanelHtml. */
  function directionHtml(o) {
    return ''
      + '<div class="won-direction" id="wonDirectionPanel">'
      +   '<h3 class="won-direction-title">📍 DIRECTION VERS LA ZONE DE RECHERCHE</h3>'
      +   '<p class="won-direction-line"><span class="won-direction-label">Indication de direction :</span> ' + esc(o.indication) + '</p>'
      +   '<div class="won-direction-steps">'
      +     '<p class="won-direction-sub">Sur place :</p>'
      +     '<ol>'
      +       '<li>Repérez le <b>QR Code</b> de la zone.</li>'
      +       '<li>Cliquez sur le bouton <b>« ' + esc(o.actionSuivante) + ' »</b> pour passer au prochain palier.</li>'
      +       '<li><b>Scannez le QR Code</b> dans l’encart prévu à cet effet (ou importez-en la photo).</li>'
      +     '</ol>'
      +   '</div>'
      +   '<div class="won-direction-remind">'
      +     '📷 <b>L’équipage souhaite poursuivre maintenant ?</b> Une fois le QR Code trouvé,'
      +     ' ouvrez la page du prochain palier et scannez-le.<br>'
      +     '<b>Vous reprendrez plus tard ?</b> Prenez le QR Code en photo et gardez-le'
      +     ' précieusement : c’est la <b>clé d’entrée du ' + esc(o.labelSuivant) + '</b> — sans lui,'
      +     ' la page restera verrouillée et personne ne pourra progresser.'
      +   '</div>'
      +   '<a class="won-next-btn" href="' + esc(o.urlSuivante) + '">⏭️ ' + esc(o.actionSuivante) + '</a>'
      + '</div>';
  }

  /* Écran « Épreuve validée ! » — miroir de renderWonScreen() du
     Palier 1 (phrase d'accueil FIGÉE, comme là-bas : pas de re-pop à
     chaque rafraîchissement). */
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
      +   '<div class="won-unlock-note">🔓 <b>Tout l’équipage reprend la quête.</b> Si un matelot'
      +   ' était bloqué en surface après un échec, son blocage est levé : il peut rejouer sans attendre.</div>'
      +   '<div class="won-actions">'
      +     '<button type="button" class="won-continue-btn" id="wonContinueBtn" aria-expanded="true" aria-controls="wonDirectionPanel">🧭 CONTINUER VERS LE PALIER SUIVANT</button>'
      +   '</div>'
      +   directionHtml(o)
      + '</div>';
    /* Bouton 🧭 : plie/déplie le panneau de direction (pour REVOIR la
       marche à suivre à tout moment) — mêmes règles que palier1.html. */
    var btn = hote.querySelector('#wonContinueBtn');
    var panel = hote.querySelector('#wonDirectionPanel');
    if (btn && panel) {
      btn.addEventListener('click', function () {
        var ouvert = !panel.hidden;
        panel.hidden = ouvert;
        btn.setAttribute('aria-expanded', String(!ouvert));
        if (!ouvert && typeof panel.scrollIntoView === 'function') {
          panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }
  }

  window.NautilusVictoire = { afficher: afficher };
})();
