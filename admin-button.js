/* Accès admin commun aux pages Mission Nautilus. */
(function(){
  function init(){
    const isIndex = !!document.getElementById('adminFabBtn');
    if(isIndex && new URLSearchParams(location.search).get('admin') === '1'){
      setTimeout(() => document.getElementById('adminFabBtn')?.click(), 700);
    }
    if(isIndex || document.getElementById('nautilusAdminShortcut')) return;
    const style = document.createElement('style');
    style.textContent = `
      #nautilusAdminShortcut{position:fixed;left:14px;bottom:14px;z-index:11000;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(142,231,255,.35);border-radius:50%;background:rgba(3,17,31,.78);color:rgba(142,231,255,.65);text-decoration:none;font-size:16px;opacity:.72;box-shadow:0 4px 12px rgba(0,0,0,.28)}
      #nautilusAdminShortcut:hover{opacity:1;color:#f5b027;border-color:#f5b027}
    `;
    document.head.appendChild(style);
    const link = document.createElement('a');
    link.id = 'nautilusAdminShortcut';
    link.href = 'index.html?admin=1';
    link.title = 'Panneau admin';
    link.setAttribute('aria-label','Ouvrir le panneau admin');
    link.textContent = '⚙';
    document.body.appendChild(link);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
