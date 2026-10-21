/* =====================================================================
   admin-artefact.js — ONGLET ADMIN « 🏪 Magasins » (remplace l'artefact)

   Injection légère dans le panneau admin existant (admin-button.js /
   index.html). Affiche et permet de mettre à jour la liste des magasins
   Fnac utilisée par le Palier 3.

   - Charge data/magasins-fnac.json (ou Firestore si plus récent)
   - Vérifie / publie la liste
   - Recherche, ajout, édition, suppression locale
   - Export JSON pour commit
   ===================================================================== */
(function () {
  'use strict';
  if (window.NautilusAdminArtefact) return;

  var ONGLET = 'magasins';
  var _monte = false;
  var _liste = null;
  var _filtre = '';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>\"\"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c];
    });
  }
  function S() { return window.NautilusArtefact; }
  function MG() { return window.NautilusMagasin; }
  function M() { return window.NautilusArtefactMoteur; }

  function dire(id, texte, kind) {
    var el = $(id);
    if (!el) return;
    el.innerHTML = texte;
    el.className = 'adm-af-msg ' + (kind || '');
    el.style.color = kind === 'ok' ? '#075c39' : kind === 'danger' ? '#9b1111' : kind === 'warn' ? '#8a5b00' : '';
  }
  function age(iso) {
    if (!iso) return '—';
    var min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (!isFinite(min)) return '—';
    if (min < 1) return 'à l’instant';
    if (min < 60) return 'il y a ' + min + ' min';
    if (min < 1440) return 'il y a ' + Math.round(min / 60) + ' h';
    return 'il y a ' + Math.round(min / 1440) + ' j';
  }

  function HTML_PANE() {
    return ''
    + '<p class=\"small\" style=\"margin-bottom:10px\">Liste des <b>magasins Fnac</b> pour le Palier 3. Elle détermine où l’ouvrage peut être cherché. Source : <code>data/magasins-fnac.json</code> (ou Firestore si publiée plus récemment).</p>'
    + '<div class=\"adm-af-sec\">'
    +   '<h4>📍 Magasins — mise à jour</h4>'
    +   '<div class=\"adm-af-ligne\">'
    +     '<button id=\"afMagReload\" class=\"secondary\" type=\"button\">↻ Recharger</button>'
    +     '<button id=\"afMagVerifier\" class=\"secondary\" type=\"button\">🧪 Vérifier</button>'
    +     '<button id=\"afMagPublier\" class=\"primary\" type=\"button\">📤 Publier (Firestore)</button>'
    +     '<button id=\"afMagExporter\" class=\"secondary\" type=\"button\">⬇️ Exporter JSON</button>'
    +   '</div>'
    +   '<p class=\"adm-af-note\" id=\"afMagEtat\">Chargement…</p>'
    +   '<p class=\"adm-af-note\" id=\"afMagMsg\"></p>'
    +   '<div class=\"adm-af-ligne\" style=\"margin-top:8px\">'
    +     '<input id=\"afMagSearch\" class=\"adm-af-input\" placeholder=\"🔍 Filtrer (nom, ville, CP, id)\" style=\"flex:1\">'
    +     '<span class=\"small\" id=\"afMagCount\"></span>'
    +   '</div>'
    +   '<div id=\"afMagTable\" style=\"margin-top:8px;max-height:360px;overflow:auto;border:1px solid #dfe8ee;border-radius:8px\"></div>'
    + '</div>'
    + '<div class=\"adm-af-sec\">'
    +   '<h4>➕ Ajouter / éditer un magasin</h4>'
    +   '<p class=\"adm-af-note\">Renseigne au minimum <b>id</b> (ex. cl999) et <b>nom</b>. La publication rend la liste active pour les joueurs ; l’export JSON sert à committer le fichier.</p>'
    +   '<div class=\"adm-af-ligne\">'
    +     '<input id=\"afMagId\" class=\"adm-af-input\" placeholder=\"id — ex. cl999\" style=\"max-width:120px\">'
    +     '<input id=\"afMagNom\" class=\"adm-af-input\" placeholder=\"Nom — ex. Labège\" style=\"flex:1\">'
    +     '<input id=\"afMagVille\" class=\"adm-af-input\" placeholder=\"Ville\" style=\"flex:1\">'
    +     '<input id=\"afMagCp\" class=\"adm-af-input\" placeholder=\"CP\" style=\"max-width:100px\">'
    +   '</div>'
    +   '<div class=\"adm-af-ligne\">'
    +     '<input id=\"afMagLat\" class=\"adm-af-input\" type=\"number\" step=\"any\" placeholder=\"lat\" style=\"max-width:120px\">'
    +     '<input id=\"afMagLon\" class=\"adm-af-input\" type=\"number\" step=\"any\" placeholder=\"lon\" style=\"max-width:120px\">'
    +     '<input id=\"afMagSlug\" class=\"adm-af-input\" placeholder=\"slug — ex. Labege/Fnac-Labege\" style=\"flex:1\">'
    +   '</div>'
    +   '<div class=\"adm-af-ligne\">'
    +     '<button id=\"afMagAjouter\" class=\"primary\" type=\"button\">➕ Ajouter / Mettre à jour</button>'
    +     '<button id=\"afMagVider\" class=\"secondary\" type=\"button\">🧹 Vider le formulaire</button>'
    +     '<span class=\"small\" id=\"afMagFormMsg\"></span>'
    +   '</div>'
    + '</div>'
    + '<p class=\"adm-af-note\" style=\"margin-top:8px\">💡 Sync hebdo : <code>tools/sync-magasins-fnac.mjs</code> + GitHub Actions régénère <code>data/magasins-fnac.json</code>. Les modifs manuelles ici sont prioritaires si publiées dans Firestore.</p>';
  }

  function injecter() {
    if (_monte) return;
    var workspace = $('adminWorkspace');
    if (!workspace) return;
    var tabs = workspace.querySelector('.admin-tabs');
    if (!tabs || workspace.querySelector('[data-pane=\"' + ONGLET + '\"]')) {
      if (workspace.querySelector('[data-pane=\"' + ONGLET + '\"]')) { _monte = true; brancher(); }
      return;
    }
    var bouton = document.createElement('button');
    bouton.className = 'admin-tab';
    bouton.type = 'button';
    bouton.setAttribute('role', 'tab');
    bouton.dataset.tab = ONGLET;
    bouton.innerHTML = '<span class=\"lbl-desktop\">🏪 Magasins</span><span class=\"lbl-mobile\" aria-label=\"Magasins\">🏪</span>';
    var danger = tabs.querySelector('[data-tab=\"danger\"]');
    if (danger) tabs.insertBefore(bouton, danger); else tabs.appendChild(bouton);
    var pane = document.createElement('div');
    pane.className = 'admin-pane';
    pane.dataset.pane = ONGLET;
    pane.style.display = 'none';
    pane.innerHTML = HTML_PANE();
    workspace.appendChild(pane);
    _monte = true;
    brancher();
  }

  function activerOnglet() {
    document.querySelectorAll('.admin-tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === ONGLET);
    });
    document.querySelectorAll('.admin-pane').forEach(function (p) {
      p.style.display = (p.dataset.pane === ONGLET ? '' : 'none');
    });
    charger(false);
  }

  function brancher() {
    var bouton = document.querySelector('.admin-tab[data-tab=\"' + ONGLET + '\"]');
    if (bouton) bouton.addEventListener('click', activerOnglet);
    var r = $('afMagReload'); if (r) r.addEventListener('click', function(){ charger(true); });
    var v = $('afMagVerifier'); if (v) v.addEventListener('click', verifier);
    var p = $('afMagPublier'); if (p) p.addEventListener('click', publier);
    var e = $('afMagExporter'); if (e) e.addEventListener('click', exporter);
    var s = $('afMagSearch'); if (s) s.addEventListener('input', function(){ _filtre = (s.value||'').toLowerCase().trim(); rendre(); });
    var a = $('afMagAjouter'); if (a) a.addEventListener('click', ajouterOuMaj);
    var cl = $('afMagVider'); if (cl) cl.addEventListener('click', viderForm);
  }

  function charger(forcer) {
    if (!MG()) { dire('afMagEtat','❌ magasin-fnac.js non chargé.','danger'); return Promise.resolve(null); }
    dire('afMagEtat','⏳ Chargement…','');
    return MG().chargerListe({ forcer: !!forcer }).then(function(liste){
      _liste = liste;
      dire('afMagEtat','<b>' + esc(liste.version||'?') + '</b> — <b>' + liste.magasins.length + '</b> magasins (' + esc(liste.source||'?') + ', ' + esc(age(liste.syncedAt)) + ')','ok');
      rendre();
      return liste;
    }).catch(function(e){
      dire('afMagEtat','❌ ' + esc(e && e.message || e),'danger');
      return null;
    });
  }

  function verifier() {
    if (!_liste) { dire('afMagMsg','Charge d’abord la liste.','warn'); return; }
    var prob = M() && M().controlerMagasins ? M().controlerMagasins(_liste.magasins, []) : [];
    var actifs = M() && M().magasinsUtilisables ? M().magasinsUtilisables(_liste.magasins).length : _liste.magasins.length;
    if (prob.length) dire('afMagMsg','❌ ' + prob.length + ' problème(s) : ' + esc(prob.slice(0,4).join(' ; ')),'danger');
    else dire('afMagMsg','✅ ' + actifs + ' actif(s), 0 doublon.','ok');
  }

  function publier() {
    if (!_liste) { dire('afMagMsg','Rien à publier.','warn'); return; }
    if (!S() || !S().publierMagasins) { dire('afMagMsg','Publication Firestore indisponible sur cette page.','warn'); return; }
    dire('afMagMsg','⏳ Publication…','');
    S().publierMagasins(_liste).then(function(doc){
      dire('afMagMsg','📤 Publiée : <b>' + esc(doc.version) + '</b> (' + doc.count + ' magasins). Active immédiatement pour les joueurs.','ok');
    }).catch(function(e){ dire('afMagMsg','❌ ' + esc(e && e.message||e),'danger'); });
  }

  function exporter() {
    if (!_liste || !_liste.magasins || !_liste.magasins.length) { dire('afMagMsg','Rien à exporter.','warn'); return; }
    var doc = { version: _liste.version, source: _liste.source, sourceType: _liste.sourceType||'admin-manuel', syncedAt: new Date().toISOString(), count: _liste.magasins.length, magasins: _liste.magasins };
    var blob = new Blob([JSON.stringify(doc,null,2)], {type:'application/json'});
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'magasins-fnac-' + doc.version + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1200);
    dire('afMagMsg','⬇️ Export téléchargé — commit le fichier dans <code>data/magasins-fnac.json</code>.','ok');
  }

  function filtreListe() {
    if (!_liste || !_liste.magasins) return [];
    if (!_filtre) return _liste.magasins;
    return _liste.magasins.filter(function(m){
      var hay = (m.id+' '+m.nom+' '+m.ville+' '+m.cp).toLowerCase();
      return hay.indexOf(_filtre) >= 0;
    });
  }

  function rendre() {
    var hote = $('afMagTable'); var count = $('afMagCount');
    if (!hote || !_liste) return;
    var arr = filtreListe();
    if (count) count.textContent = arr.length + ' / ' + _liste.magasins.length;
    if (!arr.length) { hote.innerHTML = '<p class=\"adm-af-note\" style=\"padding:10px\">Aucun magasin.</p>'; return; }
    var html = '<table class=\"adm-af-table\" style=\"width:100%\"><thead><tr><th>id</th><th>Nom — ville (CP)</th><th>lat/lon</th><th></th></tr></thead><tbody>'
      + arr.map(function(m){
        return '<tr>'
          + '<td><code>' + esc(m.id||'—') + '</code>' + (m.actif===false?'<br><span class=\"adm-af-badge adm-af-badge--warn\">inactif</span>':'') + '</td>'
          + '<td><b>' + esc(m.nom||'?') + '</b><br><span class=\"small\">' + esc(m.ville||'—') + ' ' + esc(m.cp||'') + '</span><br><span class=\"small\">' + esc(m.slug||'') + '</span></td>'
          + '<td class=\"small\">' + esc(m.lat!=null?String(m.lat):'—') + '<br>' + esc(m.lon!=null?String(m.lon):'—') + '</td>'
          + '<td style=\"white-space:nowrap\"><button class=\"secondary adm-af-mini\" data-mag-edit=\"' + esc(m.id) + '\" type=\"button\">✏️</button> <button class=\"danger adm-af-mini\" data-mag-del=\"' + esc(m.id) + '\" type=\"button\">🗑️</button></td>'
          + '</tr>';
      }).join('') + '</tbody></table>';
    hote.innerHTML = html;
    hote.querySelectorAll('[data-mag-edit]').forEach(function(b){
      b.addEventListener('click', function(){
        var id = b.dataset.magEdit;
        var m = _liste.magasins.filter(function(x){ return x.id===id; })[0];
        if (!m) return;
        $('afMagId').value = m.id||'';
        $('afMagNom').value = m.nom||'';
        $('afMagVille').value = m.ville||'';
        $('afMagCp').value = m.cp||'';
        $('afMagLat').value = m.lat!=null? m.lat : '';
        $('afMagLon').value = m.lon!=null? m.lon : '';
        $('afMagSlug').value = m.slug||'';
        dire('afMagFormMsg','✏️ Édition : '+esc(m.nom),'');
        $('afMagId').scrollIntoView({behavior:'smooth', block:'center'});
      });
    });
    hote.querySelectorAll('[data-mag-del]').forEach(function(b){
      b.addEventListener('click', function(){
        var id = b.dataset.magDel;
        if (!confirm('Supprimer le magasin ' + id + ' ?')) return;
        _liste.magasins = _liste.magasins.filter(function(x){ return x.id!==id; });
        _liste.count = _liste.magasins.length;
        dire('afMagFormMsg','🗑️ Supprimé : '+esc(id)+' — pense à publier/exporter.','warn');
        rendre();
      });
    });
  }

  function viderForm(){
    ['afMagId','afMagNom','afMagVille','afMagCp','afMagLat','afMagLon','afMagSlug'].forEach(function(i){ var el=$(i); if(el) el.value=''; });
    dire('afMagFormMsg','','');
  }
  function ajouterOuMaj(){
    var id = ($('afMagId').value||'').trim();
    var nom = ($('afMagNom').value||'').trim();
    if (!id || !nom) { dire('afMagFormMsg','❌ id et nom obligatoires.','danger'); return; }
    if (!/^cl[0-9A-Za-z_-]+$/.test(id) && !/^cl[0-9]+$/.test(id)) {
      // tolère tout id non vide, mais signale
    }
    var ville = ($('afMagVille').value||'').trim();
    var cp = ($('afMagCp').value||'').trim().replace(/[^0-9]/g,'');
    var latS = ($('afMagLat').value||'').trim(); var lat = latS? Number(latS): undefined;
    var lonS = ($('afMagLon').value||'').trim(); var lon = lonS? Number(lonS): undefined;
    var slug = ($('afMagSlug').value||'').trim();
    var fiche = { id:id, nom:nom, ville:ville, cp:cp, slug:slug };
    if (lat!=null && isFinite(lat)) fiche.lat = lat;
    if (lon!=null && isFinite(lon)) fiche.lon = lon;
    // via normaliser si dispo
    if (MG() && MG().normaliserMagasin) {
      var n = MG().normaliserMagasin(fiche);
      if (!n) { dire('afMagFormMsg','❌ Fiche invalide.','danger'); return; }
      fiche = n;
    }
    if (!_liste) { dire('afMagFormMsg','Charge d’abord la liste.','warn'); return; }
    var idx = -1; for(var i=0;i<_liste.magasins.length;i++) if(_liste.magasins[i].id===id) idx=i;
    if (idx>=0) { _liste.magasins[idx] = Object.assign({}, _liste.magasins[idx], fiche); dire('afMagFormMsg','✅ Mis à jour : '+esc(nom),'ok'); }
    else { _liste.magasins.push(fiche); _liste.count = _liste.magasins.length; dire('afMagFormMsg','✅ Ajouté : '+esc(nom),'ok'); }
    rendre();
  }

  function observer(){
    if ($('adminWorkspace')) { injecter(); return; }
    var mo = new MutationObserver(function(){ if($('adminWorkspace')){ injecter(); if(_monte) mo.disconnect(); }});
    mo.observe(document.body||document.documentElement,{childList:true,subtree:true});
    setTimeout(injecter,1200); setTimeout(injecter,3500);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', observer); else observer();

  window.NautilusAdminArtefact = {
    ONGLET: ONGLET, injecter: injecter, activerOnglet: activerOnglet,
    estMonte: function(){ return _monte; }
  };
})();
