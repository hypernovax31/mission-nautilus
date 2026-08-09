/* =============================================================================
   Accès admin commun aux pages Mission Nautilus.
   -----------------------------------------------------------------------------
   Sur la page d'accueil (index.html), le panneau admin est integré à la page :
   on se contente de déclencher son bouton d'engrenage.

   Sur TOUTES les autres pages (palier1, classement, futures pages), on ne
   redirige plus vers index.html : on ouvre une MODALE fixe par-dessus la page
   courante, qui charge le panneau admin autonome (admin.html) dans une iframe.
   Ainsi le panneau apparaît sur la page où l'on se trouve, sans quitter
   celle-ci, et au-dessus de toutes les animations (z-index 12000).
============================================================================= */
(function(){
  function openAdminModal(){
    const old = document.getElementById('nautilusAdminModal');
    if(old) old.remove();
    // Chemin vers admin.html, relatif au dossier courant (GitHub Pages OK).
    const adminUrl = 'admin.html';

    const overlay = document.createElement('div');
    overlay.id = 'nautilusAdminModal';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Panneau admin');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:12000;'+
      'background:rgba(2,8,18,.82);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);'+
      'display:flex;align-items:center;justify-content:center;padding:clamp(8px,2vw,24px);box-sizing:border-box;';

    const frame = document.createElement('iframe');
    frame.src = adminUrl;
    frame.title = 'Panneau admin';
    frame.style.cssText =
      'width:100%;height:100%;max-width:920px;max-height:calc(100vh - 40px);max-height:calc(100dvh - 40px);'+
      'border:1px solid rgba(245,176,39,.5);border-radius:16px;background:#fff;'+
      'box-shadow:0 26px 80px rgba(0,0,0,.6);';

    overlay.appendChild(frame);

    // Fermeture : clic sur le fond sombre hors de l'iframe, touche Echap, ou
    // message posté par admin.html quand on appuie sur son bouton ✕.
    function close(){
      if(overlay.parentNode) overlay.parentNode.removeChild(overlay);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e){ if(e.key === 'Escape') close(); }
    overlay.addEventListener('click', e => { if(e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    window.addEventListener('message', function onMsg(ev){
      if(ev.data && ev.data.type === 'NAUTILUS_ADMIN_CLOSE'){ close(); }
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  function init(){
    const isIndex = !!document.getElementById('adminFabBtn');
    if(isIndex && new URLSearchParams(location.search).get('admin') === '1'){
      setTimeout(() => document.getElementById('adminFabBtn')?.click(), 700);
      return;
    }
    // Page d'accueil : son panneau intégré gère déjà l'engrenage.
    if(isIndex || document.getElementById('nautilusAdminShortcut')) return;

    const style = document.createElement('style');
    style.textContent = `
      #nautilusAdminShortcut{position:fixed;left:14px;bottom:14px;z-index:11000;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(142,231,255,.35);border-radius:50%;background:rgba(3,17,31,.78);color:rgba(142,231,255,.65);text-decoration:none;font-size:16px;opacity:.72;box-shadow:0 4px 12px rgba(0,0,0,.28)}
      #nautilusAdminShortcut:hover{opacity:1;color:#f5b027;border-color:#f5b027}
    `;
    document.head.appendChild(style);
    const link = document.createElement('button');
    link.id = 'nautilusAdminShortcut';
    link.type = 'button';
    link.title = 'Panneau admin';
    link.setAttribute('aria-label','Ouvrir le panneau admin');
    link.textContent = '⚙';
    link.style.cssText = 'cursor:pointer;padding:0;margin:0';
    link.addEventListener('click', openAdminModal);
    document.body.appendChild(link);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
