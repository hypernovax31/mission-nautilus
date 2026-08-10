/* =============================================================
   JOURNAL DE BORD — « Activité en direct » — CODE COMMUN À TOUS
   LES PALIERS.

   Ce fichier reprend À L'IDENTIQUE le journal de bord du Palier 1
   (palier1.html) : même rendu, même tri, même limite, même format
   d'heure. Chaque palier (palier1.html, portail 1721310619.html,
   futurs paliers…) charge ce script et dispose du même suivi en
   direct, là où le joueur se trouve.

   La page doit contenir le bloc HTML :

     <section class="card" id="logCard">
       <h2>📜 JOURNAL DE BORD</h2>
       <div class="body">
         <div class="morse-log">
           <h3>Activité en direct</h3>
           <ul id="morse-log-list"></ul>
         </div>
       </div>
     </section>

   … et la feuille css/palier1.css (styles .morse-log + mention
   « journal vide »). L'API :

     JournalDeBord.addLogEntry(texte, kind, quand)
       kind : 'info' | 'success' | 'warning' | 'danger'
       quand : Date optionnelle de l'événement (sinon : maintenant)
       Seules les balises <b></b> sont autorisées dans le texte.
     JournalDeBord.clearLog()
     JournalDeBord.afficher(id?)  — montre la carte (défaut #logCard)
     JournalDeBord.masquer(id?)   — masque la carte
   ============================================================= */
(function () {
  'use strict';

  /* Échappe TOUT — un nom de matelot est saisi librement et ne doit
     jamais pouvoir injecter du code — puis l'appelant ne rétablit que
     <b> et </b>, les deux seules balises autorisées dans le journal. */
  function journalEsc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function addLogEntry(text, kind = 'info', quand) {
    const list = document.getElementById('morse-log-list');
    if (!list) return;
    const colors = {
      info:    { dot: '#8ee7ff', border: 'rgba(142,231,255,.4)' },
      success: { dot: '#5be09b', border: 'rgba(91,255,156,.5)' },
      warning: { dot: '#ffd36c', border: 'rgba(245,176,39,.5)' },
      danger:  { dot: '#ff7b72', border: 'rgba(255,75,62,.55)' }
    };
    const c = colors[kind] || colors.info;

    /* CHRONOLOGIE GARANTIE (correctif historique du Palier 1).

       Chaque ligne porte l'INSTANT RÉEL de l'événement et l'insertion
       se fait À LA BONNE PLACE dans la liste, en comparant les
       horodatages : une ligne écrite après une attente réseau ne peut
       pas en doubler une plus ancienne et casser l'ordre réel. */
    const t = (quand instanceof Date) ? quand : new Date();
    /* JOUR ET HEURE au format court (« 06/08 00:09 ») : une épreuve
       peut être reprise le lendemain ; sans le jour, deux lignes
       éloignées de 24 h affichaient exactement la même chose. */
    const p2 = (n) => String(n).padStart(2, '0');
    const heure = p2(t.getDate()) + '/' + p2(t.getMonth() + 1) + ' '
                + p2(t.getHours()) + ':' + p2(t.getMinutes());

    const li = document.createElement('li');
    li.className = 'morse-log-entry';
    li.dataset.t = String(t.getTime());
    li.style.cssText = `display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-left:3px solid ${c.border};background:rgba(0,0,0,.22);border-radius:8px;`;

    const texteRendu = journalEsc(text)
      .replace(/&lt;b&gt;/g, '<b>')
      .replace(/&lt;\/b&gt;/g, '</b>');

    li.innerHTML = `
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.dot};box-shadow:0 0 8px ${c.dot};flex:0 0 10px;margin-top:5px;"></span>
      <span style="flex:1;min-width:0;color:#dff6ff;line-height:1.4;">${texteRendu}</span>
      <span style="flex:0 0 auto;color:rgba(142,231,255,.42);font-size:11px;font-family:Consolas,'Courier New',monospace;margin-top:3px;white-space:nowrap;">${heure}</span>
    `;

    /* Insertion triée : la liste va du plus RÉCENT (en haut) au plus
       ancien. On descend jusqu'à trouver une ligne plus ancienne. */
    const ms = t.getTime();
    let place = null;
    for (const ligne of list.children) {
      if (Number(ligne.dataset.t || 0) <= ms) { place = ligne; break; }
    }
    if (place) list.insertBefore(li, place);
    else list.appendChild(li);

    /* Limite à 20 entrées : on retire les plus ANCIENNES (en bas). */
    while (list.children.length > 20) list.removeChild(list.lastChild);
  }

  function clearLog() {
    const list = document.getElementById('morse-log-list');
    if (list) list.innerHTML = '';
  }

  /* Visibilité de la carte journal (le Palier 1 utilise son propre
     $('logCard').style.display ; les deux écrivent la même chose). */
  function afficher(idCarte) {
    const el = document.getElementById(idCarte || 'logCard');
    if (el) el.style.display = 'block';
  }
  function masquer(idCarte) {
    const el = document.getElementById(idCarte || 'logCard');
    if (el) el.style.display = 'none';
  }

  window.JournalDeBord = { addLogEntry, clearLog, afficher, masquer };
})();
