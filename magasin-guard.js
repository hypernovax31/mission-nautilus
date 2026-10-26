/* =====================================================================
   GARDE MAGASIN D'ORIGINE — mission-nautilus (magasin-guard.js) v1
   Règle : quand la partie globale a démarré (game/config.missionStartedAt != null),
   l'accès aux paliers est réservé au magasin d'origine.
   - changement de magasin -> refus
   - géolocalisation >500 m du magasin d'origine -> refus (mauvaise géoloc = hors magasin)
   Remplace le bouton « Reprendre la mission » par un message simple et concis.
   Dépend de : magasin-fnac.js (NautilusMagasin), artefact-moteur.js (distance),
               matelot-blocages.js / Firestore game/config (NautilusBlocages.db).
   ===================================================================== */
(function(){
  'use strict';
  if(window.NautilusMagasinGuard) return;

  var CLE_ORIGINE_LOCAL = 'nautilusMagasinOrigine';
  var SEUIL_KM = 0.5; // 500 m

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"]/g,function(c){return c==='&'?'&amp;':c==='<'?'&lt;':c==='>'?'&gt;':c==='"'?'&quot;':'&#39;';}).replace(/'/g,'&#39;');
  }

  function distanceKm(lat1,lon1,lat2,lon2){
    if(window.NautilusArtefactMoteur && typeof window.NautilusArtefactMoteur.distanceKm==='function'){
      try{ return window.NautilusArtefactMoteur.distanceKm(lat1,lon1,lat2,lon2); }catch(e){}
    }
    var R=6371, dLat=rad(lat2-lat1), dLon=rad(lon2-lon1);
    var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
    return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))*10)/10;
  }
  function rad(d){ return d*Math.PI/180; }

  // Lecture souple de game/config (Firestore) avec repli localStorage
  async function lireConfig(){
    // 1) via NautilusBlocages.db (source principale)
    try{
      if(window.NautilusBlocages && window.NautilusBlocages.db){
        var x = await window.NautilusBlocages.db();
        var snap = await x.fs.getDoc(x.fs.doc(x.db,'game','config'));
        if(snap && snap.exists()) return snap.data() || {};
      }
    }catch(e){}
    // 2) repli mémoire partagée (index.html stocke nautilusMissionConfig)
    try{
      var brut = localStorage.getItem('nautilusMissionConfig');
      if(brut){ var c=JSON.parse(brut); if(c) return c; }
    }catch(e){}
    return {};
  }

  function lireOrigineDepuisConfig(cfg){
    if(!cfg) return null;
    // format nouveau : cfg.magasinOrigine = {id,nom,ville,cp,lat,lon,setAt,setBy}
    if(cfg.magasinOrigine && cfg.magasinOrigine.id) return cfg.magasinOrigine;
    // format plat rétro-compatible
    if(cfg.magasinOrigineId){
      var o={ id:String(cfg.magasinOrigineId), nom:String(cfg.magasinOrigineNom||cfg.magasinOrigineId), ville:String(cfg.magasinOrigineVille||''), cp:String(cfg.magasinOrigineCp||''), setAt:cfg.magasinOrigineSetAt||null, setBy:cfg.magasinOrigineSetBy||null };
      if(typeof cfg.magasinOrigineLat==='number') o.lat=cfg.magasinOrigineLat;
      if(typeof cfg.magasinOrigineLon==='number') o.lon=cfg.magasinOrigineLon;
      return o;
    }
    return null;
  }

  function lireOrigineLocale(){
    try{
      var brut=localStorage.getItem(CLE_ORIGINE_LOCAL);
      if(!brut) return null;
      var o=JSON.parse(brut);
      return o && o.id ? o : null;
    }catch(e){ return null; }
  }

  function ecrireOrigineLocale(orig){
    try{ localStorage.setItem(CLE_ORIGINE_LOCAL, JSON.stringify(orig)); }catch(e){}
  }

  async function persisterOrigine(cfgExistante, orig){
    ecrireOrigineLocale(orig);
    try{
      if(window.NautilusBlocages && window.NautilusBlocages.db){
        var x = await window.NautilusBlocages.db();
        await x.fs.setDoc(x.fs.doc(x.db,'game','config'), { magasinOrigine: orig, updatedAt:new Date().toISOString() }, {merge:true});
      }
    }catch(e){}
  }

  function magasinDepuisURL(){
    try{
      var m=(location.search.match(/[?&]magasin=([^&]+)/)||[])[1];
      if(m) return decodeURIComponent(m);
      var m2=(location.search.match(/[?&]magasinId=([^&]+)/)||[])[1];
      if(m2) return decodeURIComponent(m2);
    }catch(e){}
    return null;
  }

  async function ficheCompletePour(id){
    if(!id) return null;
    try{
      if(window.NautilusMagasin && window.NautilusMagasin.trouver){
        var r=await window.NautilusMagasin.trouver(id);
        if(r && r.magasin) return r.magasin;
      }
      if(window.NautilusMagasin && window.NautilusMagasin.chargerListe){
        var liste=await window.NautilusMagasin.chargerListe().catch(function(){return null;});
        if(liste && window.NautilusArtefactMoteur && window.NautilusArtefactMoteur.trouverMagasin){
          var m=window.NautilusArtefactMoteur.trouverMagasin(liste.magasins, id);
          if(m) return m;
        }
      }
    }catch(e){}
    return null;
  }

  // Construit une origine depuis une fiche sélectionnée / complète
  function origineDepuisFiche(fiche, full){
    if(!fiche || !fiche.id) return null;
    var src = full && full.id ? full : fiche;
    var o={ id:String(src.id || fiche.id), nom:String(src.nom || fiche.nom || fiche.id), ville:String(src.ville||fiche.ville||''), cp:String(src.cp||fiche.cp||''), setAt:new Date().toISOString() };
    if(typeof src.lat==='number') o.lat=src.lat;
    if(typeof src.lon==='number') o.lon=src.lon;
    // setBy renseigné si possible via identité
    return o;
  }

  function isAdminBypass(){
    try{
      var c = '';
      try{ c = (localStorage.getItem('nautilusMatelotCode')||'').toUpperCase().trim(); }catch(e){}
      if(c === 'ZZZZ-0000') return true;
      if(/[?&]m=ZZZZ-0000(?:&|$)/i.test(location.search)) return true;
      if(/[?&]apercu=jeu/i.test(location.search)) return true;
      try{ if(window.Nautilus && window.Nautilus.isTestMode && window.Nautilus.isTestMode()) return true; }catch(e){}
      try{ if(window.NautilusBlocages && window.NautilusBlocages.CODE_TEST && c === window.NautilusBlocages.CODE_TEST) return true; }catch(e){}
    }catch(e){}
    return false;
  }

  // Vérification principale : autorise-t-on l'accès ?
  async function verifierAcces(opts){
    opts=opts||{};
    if(isAdminBypass()){
      var cfgPre = await lireConfig().catch(function(){ return {}; });
      return { autorise:true, missionStarted:!!(cfgPre && cfgPre.missionStartedAt), motif:'admin-bypass', cfg:cfgPre, adminBypass:true };
    }
    var cfg = await lireConfig();
    var missionStarted = !!(cfg && cfg.missionStartedAt);
    if(!missionStarted){
      return { autorise:true, missionStarted:false, motif:'pas-commencee', cfg:cfg };
    }
    var origine = lireOrigineDepuisConfig(cfg) || lireOrigineLocale();

    // Récupère le magasin courant (sélection site-wide)
    var courant = null;
    try{
      if(window.NautilusMagasin && window.NautilusMagasin.courant) courant = window.NautilusMagasin.courant();
    }catch(e){}
    if(!courant){
      var urlId = magasinDepuisURL();
      if(urlId) courant = { id:urlId, nom:urlId };
    }
    // Si une fiche force est passée (ex: artefact-palier3.js etat.magasin)
    if(opts.magasin && opts.magasin.id) courant = opts.magasin;

    // Mode legacy : mission démarrée mais origine jamais figée -> on la fige maintenant sur le magasin courant
    if(!origine){
      if(courant && courant.id){
        try{
          var full = await ficheCompletePour(courant.id);
          var orig = origineDepuisFiche(courant, full);
          if(orig){
            // enrichit setBy si identité dispo
            try{
              if(window.NautilusBlocages && window.NautilusBlocages.identiteCourante){
                var ident = await window.NautilusBlocages.identiteCourante().catch(function(){return null;});
                if(ident && ident.teamCode) orig.setBy = ident.teamCode;
              }
            }catch(e){}
            await persisterOrigine(cfg, orig);
            origine = orig;
          }
        }catch(e){}
      }
      // Sans courant on ne peut pas figer : on laisse passer pour permettre la sélection
      if(!origine){
        return { autorise:true, missionStarted:true, motif:'origine-manquante', cfg:cfg, origine:null, courant:courant };
      }
    }

    // Complète l'origine si lat/lon manquent mais disponibles dans la liste officielle
    if(origine && (typeof origine.lat!=='number' || typeof origine.lon!=='number')){
      try{
        var fullOri = await ficheCompletePour(origine.id);
        if(fullOri && typeof fullOri.lat==='number' && typeof fullOri.lon==='number'){
          origine.lat = fullOri.lat; origine.lon = fullOri.lon;
          if(fullOri.ville) origine.ville = origine.ville || fullOri.ville;
          if(fullOri.nom) origine.nom = origine.nom || fullOri.nom;
          ecrireOrigineLocale(origine);
        }
      }catch(e){}
    }

    if(!courant || !courant.id){
      return { autorise:false, missionStarted:true, motif:'sans-magasin', cfg:cfg, origine:origine, courant:courant, message:"Choisis d'abord le magasin d'origine sur la page d'accueil." };
    }

    // Changement de magasin
    if(String(courant.id) !== String(origine.id)){
      return { autorise:false, missionStarted:true, motif:'changement-magasin', cfg:cfg, origine:origine, courant:courant, message:"Mission réservée au magasin d'origine." };
    }

    // Même magasin -> vérification géoloc < 500 m
    if(typeof origine.lat==='number' && typeof origine.lon==='number'){
      var geo=null;
      try{
        if(window.NautilusMagasin && window.NautilusMagasin.geolocaliser){
          geo = await window.NautilusMagasin.geolocaliser({ delaiMs: 11000 });
        } else if(navigator.geolocation){
          geo = await new Promise(function(res){
            var fini=false; var tid=setTimeout(function(){ if(!fini){fini=true; res({erreur:'delai'});} }, 11000);
            try{
              navigator.geolocation.getCurrentPosition(function(pos){ if(fini) return; fini=true; clearTimeout(tid); res({lat:pos.coords.latitude, lon:pos.coords.longitude, precision: Math.round(pos.coords.accuracy||0)}); },
              function(err){ if(fini) return; fini=true; clearTimeout(tid); res({erreur: err&&err.code===1?'refus':'indisponible'}); },
              { enableHighAccuracy:false, timeout:11000, maximumAge:300000 });
            }catch(e){ if(!fini){fini=true; clearTimeout(tid); res({erreur:'indisponible'});} }
          });
        }
      }catch(e){ geo={erreur:'indisponible'}; }

      if(!geo || geo.erreur){
        var msgGeo = geo && geo.erreur==='refus' ? "Active la géolocalisation et reviens à moins de 500 m." : "Position indisponible — rapproche-toi du magasin d'origine.";
        return { autorise:false, missionStarted:true, motif:'geoloc-'+(geo&&geo.erreur||'indispo'), cfg:cfg, origine:origine, courant:courant, geo:geo, message:msgGeo };
      }
      // précision jugée mauvaise si >500 m (spéc demande)
      if(typeof geo.precision==='number' && geo.precision>500){
        return { autorise:false, missionStarted:true, motif:'geoloc-imprecise', cfg:cfg, origine:origine, courant:courant, geo:geo, distanceKm:null, message:"Géolocalisation trop imprécise — rapproche-toi du magasin d'origine." };
      }
      var d = distanceKm(geo.lat, geo.lon, origine.lat, origine.lon);
      if(d > SEUIL_KM){
        return { autorise:false, missionStarted:true, motif:'hors-zone', cfg:cfg, origine:origine, courant:courant, geo:geo, distanceKm:d, message:"Hors zone du magasin d'origine." };
      }
      return { autorise:true, missionStarted:true, motif:'ok-geoloc', cfg:cfg, origine:origine, courant:courant, geo:geo, distanceKm:d };
    }

    // Sans coordonnées d'origine : on se contente de l'id
    return { autorise:true, missionStarted:true, motif:'ok-sans-coords', cfg:cfg, origine:origine, courant:courant };
  }

  // Fabrique le HTML du message concis (remplace le bouton)
  function messageHTML(info){
    info = info || {};
    var origine = info.origine || {};
    var courant = info.courant || {};
    var nomOrigine = esc(origine.nom || origine.id || 'd’origine');
    var villeOrigine = origine.ville ? ' ('+esc(origine.ville)+')' : '';
    var motif = info.motif || '';
    var distanceTxt = (typeof info.distanceKm==='number') ? (' — à '+ esc(String(info.distanceKm).replace('.',','))+' km') : '';
    var titre = '⛔ Hors magasin d’origine';
    var corps = '';
    if(motif==='changement-magasin'){
      var nomCourant = esc(courant.nom || courant.id || 'un autre magasin');
      corps = 'Mission démarrée à la <b>Fnac '+ nomOrigine + villeOrigine +'</b>. Tu as sélectionné <b>Fnac '+ nomCourant +'</b> — retourne dans le magasin d’origine pour continuer.';
    } else if(motif==='hors-zone'){
      corps = 'Tu es'+distanceTxt+' de la <b>Fnac '+ nomOrigine + villeOrigine +'</b>. Rapproche-toi à <b>moins de 500 m</b> pour reprendre la mission.';
    } else if(motif==='geoloc-refus' || motif==='geoloc-imprecise' || (motif||'').indexOf('geoloc')===0){
      corps = 'Active la <b>géolocalisation</b> et reviens à moins de <b>500 m</b> de la <b>Fnac '+ nomOrigine + villeOrigine +'</b> pour reprendre la mission.';
    } else if(motif==='sans-magasin'){
      corps = 'Sélectionne d’abord le <b>magasin d’origine</b> sur la page d’accueil, puis reviens à moins de 500 m pour jouer.';
    } else {
      corps = 'Tu n’es plus dans le magasin d’origine <b>Fnac '+ nomOrigine + villeOrigine +'</b>. Rapproche-toi à <b>moins de 500 m</b> pour reprendre la mission.';
    }

    // Message simple et concis + relais
    var html = '<div class="af-carte af-carte--scellee" style="border-color:#ffb4a2;background:linear-gradient(180deg,#2a0f0f 0%,#1a0a0a 100%)">'
      + '<p class="af-kicker">Magasin d’origine requis</p>'
      + '<h3 class="af-titre">'+titre+'</h3>'
      + '<p class="af-msg">'+corps+'<br><span style="opacity:.9">Un coéquipier sur place peut prendre le relais immédiatement.</span></p>'
      + '<div class="af-actions">'
      + '<button type="button" class="af-btn" id="afGuardRetry">📍 Vérifier ma position</button>'
      + '<a href="index.html?ecoutille=0" class="af-btn af-btn--ghost">🏠 Accueil</a>'
      + '</div>'
      + '</div>';
    return html;
  }

  // Pose l'origine au démarrage global (appelée depuis index.html)
  async function assurerOrigineDepuisCourant(){
    try{
      var cfg = await lireConfig();
      if(!cfg || !cfg.missionStartedAt) return null;
      var ori = lireOrigineDepuisConfig(cfg) || lireOrigineLocale();
      if(ori && ori.id) return ori;
      var courant=null;
      try{ if(window.NautilusMagasin && window.NautilusMagasin.courant) courant=window.NautilusMagasin.courant(); }catch(e){}
      if(!courant || !courant.id) return null;
      var full = await ficheCompletePour(courant.id);
      var orig = origineDepuisFiche(courant, full);
      if(!orig) return null;
      await persisterOrigine(cfg, orig);
      return orig;
    }catch(e){ return null; }
  }

  window.NautilusMagasinGuard = {
    SEUIL_KM: SEUIL_KM,
    CLE_ORIGINE_LOCAL: CLE_ORIGINE_LOCAL,
    verifierAcces: verifierAcces,
    messageHTML: messageHTML,
    assurerOrigineDepuisCourant: assurerOrigineDepuisCourant,
    distanceKm: distanceKm,
    _lireConfig: lireConfig
  };
})();
