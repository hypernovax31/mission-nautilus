/**
 * PWA Install Helper
 * Detection de l'OS + instructions d'installation specifiques
 * par plateforme (iOS, Android, macOS, Windows, Linux).
 *
 * Un seul bouton "📲 Installer l'app" dans la top-bar declenche openInstallModal()
 * qui ouvre une modale avec les instructions visuelles.
 */

// HTML inline du sous-marin NAUTILUS (affiche en haut de la modale)
const PWA_SUBMARINE_HTML = '<svg class="pwa-submarine" viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="hull" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#f5b027"/><stop offset="100%" stop-color="#c8861b"/></linearGradient><linearGradient id="hull2" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#d89020"/><stop offset="100%" stop-color="#a06b15"/></linearGradient></defs><ellipse cx="100" cy="50" rx="78" ry="18" fill="url(#hull)" stroke="#5c4630" stroke-width="2"/><rect x="80" y="22" width="40" height="22" rx="4" fill="#5c4630"/><circle cx="88" cy="33" r="3" fill="#8ee7ff"/><circle cx="100" cy="33" r="3" fill="#8ee7ff"/><circle cx="112" cy="33" r="3" fill="#8ee7ff"/><ellipse cx="180" cy="50" rx="14" ry="9" fill="url(#hull2)" stroke="#5c4630" stroke-width="2"/><path d="M 20 60 Q 50 56 80 60 T 140 60" stroke="#8ee7ff" stroke-width="2" fill="none" opacity="0.4"/><path d="M 20 68 Q 50 64 80 68 T 140 68" stroke="#8ee7ff" stroke-width="2" fill="none" opacity="0.3"/></svg><div class="pwa-submarine-label">Nautilus</div>';

// Detection de la plateforme
const PWA_PLATFORM = (function detect(){
  const ua = navigator.userAgent;
  if(/iPhone|iPad|iPod/.test(ua)) return { id: 'ios', name: 'iOS' };
  if(/Android/i.test(ua)) return { id: 'android', name: 'Android' };
  if(/Macintosh|Mac OS X/.test(ua)) return { id: 'macos', name: 'macOS' };
  if(/Windows/.test(ua)) return { id: 'windows', name: 'Windows' };
  if(/Linux|X11/.test(ua)) return { id: 'linux', name: 'Linux' };
  return { id: 'other', name: 'cet appareil' };
})();

let pwaDeferredPrompt = null;
let pwaInstalled = (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);

// Capture le prompt natif Android Chrome
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  pwaDeferredPrompt = e;
});

window.addEventListener('appinstalled', () => {
  pwaInstalled = true;
  pwaDeferredPrompt = null;
  showToast('Mission Nautilus installee !', '#075c39');
});

// Service worker (PWA offline)
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// Toast simple
function showToast(msg, color){
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `position:fixed;right:20px;bottom:90px;z-index:10004;background:${color || '#075c39'};color:#fff;padding:14px 18px;border-radius:14px;font-weight:900;box-shadow:0 14px 28px rgba(0,0,0,.32);font-size:13px;max-width:min(90vw,360px);border:1px solid rgba(255,255,255,.18);transition:opacity .4s`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; }, 3200);
  setTimeout(() => t.remove(), 3700);
}

// Helper pour faire des sauts de ligne en toute securite
function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Contenu par plateforme
const PWA_CONTENT = {
  ios: {
    title: 'Installe Mission Nautilus sur ton iPhone',
    subtitle: 'En 3 gestes, l’app sera sur ton écran d’accueil.',
    steps: [
      { text: 'Touche le bouton <b>...</b> (3 petits points) en haut à droite de Safari', hint: 'C’est le menu de la page, pas les onglets' },
      { text: 'Appuie sur <b>Partager</b> en haut du menu', hint: 'Icône carré avec une flèche vers le haut' },
      { text: 'Sélectionne <b>Ajouter à l’écran d’accueil</b>', hint: 'Puis confirme en appuyant sur Ajouter' }
    ],
    tip: 'L’app apparaîtra avec son icône sous-marin sur ton Springboard, même hors ligne.'
  },
  android: {
    title: 'Installe Mission Nautilus sur ton Android',
    subtitle: 'Tu peux utiliser le menu du navigateur ou le prompt natif.',
    steps: [
      { text: 'Appuie sur le menu <b>⋮</b> en haut à droite de Chrome', hint: 'Trois petits points verticaux' },
      { text: 'Choisis <b>Installer l’application</b> ou <b>Ajouter à l’écran d’accueil</b>', hint: 'Le libellé dépend de ta version de Chrome' },
      { text: 'Confirme en appuyant sur <b>Installer</b>' }
    ],
    tip: 'Sur Samsung Internet, le menu est différent : ☰ puis <b>Ajouter à l’accueil</b>.'
  },
  macos: {
    title: 'Installe Mission Nautilus sur ton Mac',
    subtitle: 'Safari te permet d’ajouter l’app au Dock.',
    steps: [
      { text: 'Dans Safari, va dans le menu <b>Fichier</b> en haut de l’écran' },
      { text: 'Choisis <b>Ajouter au Dock…</b>', hint: 'Ou « Ajouter à la barre d’onglets » sur les anciennes versions' },
      { text: 'Confirme en cliquant sur <b>Ajouter</b>' }
    ],
    tip: 'L’app s’ouvrira dans sa propre fenêtre, sans la barre d’adresse Safari.'
  },
  windows: {
    title: 'Installe Mission Nautilus sur ton PC Windows',
    subtitle: 'Utilise Microsoft Edge pour une installation complète.',
    steps: [
      { text: 'Ouvre cette page dans <b>Microsoft Edge</b> (pas Chrome)', hint: 'Edge gère les PWA nativement' },
      { text: 'Clique sur le menu <b>⋯</b> en haut à droite' },
      { text: 'Choisis <b>Applications</b> puis <b>Installer ce site en tant qu’application</b>' }
    ],
    tip: 'Sinon, ajoute cette page à tes favoris (<b>Ctrl + D</b>) pour y accéder rapidement.'
  },
  linux: {
    title: 'Installe Mission Nautilus sur ton Linux',
    subtitle: 'Les PWA sont supportées sur Chromium, Edge et Brave.',
    steps: [
      { text: 'Ouvre cette page dans <b>Chromium</b>, <b>Edge</b> ou <b>Brave</b>' },
      { text: 'Clique sur l’icône <b>⊕ Installer</b> à droite de la barre d’adresse' },
      { text: 'Confirme l’installation' }
    ],
    tip: 'Sinon, mets cette page en favori (<b>Ctrl + D</b>) pour y accéder rapidement.'
  },
  other: {
    title: 'Installe Mission Nautilus',
    subtitle: 'Pour profiter de l’expérience complète.',
    steps: [
      { text: 'Ouvre cette page dans <b>Chrome</b>, <b>Edge</b> ou <b>Safari</b>' },
      { text: 'Cherche l’option « Installer l’application » dans le menu' },
      { text: 'Confirme l’installation' }
    ],
    tip: 'Sinon, mets cette page en favori pour y accéder rapidement.'
  }
};

async function openInstallModal(){
  if(pwaInstalled){
    showToast('App deja installee sur ton ' + PWA_PLATFORM.name, '#075c39');
    return;
  }
  // Android : tente d'abord le prompt natif
  if(PWA_PLATFORM.id === 'android' && pwaDeferredPrompt){
    try{
      pwaDeferredPrompt.prompt();
      const choice = await pwaDeferredPrompt.userChoice;
      if(choice.outcome === 'accepted'){
        showToast('Installation lancee...', '#075c39');
      }
      pwaDeferredPrompt = null;
      return;
    }catch(e){}
  }
  showInstallInstructions();
}

function showInstallInstructions(){
  const existing = document.getElementById('pwaInstallModal');
  if(existing) existing.remove();

  const c = PWA_CONTENT[PWA_PLATFORM.id] || PWA_CONTENT.other;
  const stepsHtml = c.steps.map((s, i) => (
    '<li>' +
      '<span class="pwa-step-num">' + (i+1) + '</span>' +
      '<div class="pwa-step-body">' +
        '<div class="pwa-step-text">' + s.text + '</div>' +
        (s.hint ? '<div class="pwa-step-hint">' + s.hint + '</div>' : '') +
      '</div>' +
    '</li>'
  )).join('');

  const overlay = document.createElement('div');
  overlay.id = 'pwaInstallModal';
  overlay.className = 'pwa-modal';
  overlay.innerHTML =
    '<div class="pwa-modal-card">' +
      '<button type="button" class="pwa-modal-close" aria-label="Fermer" data-close>✕</button>' +
      '<div class="pwa-modal-emoji">' + PWA_SUBMARINE_HTML + '</div>' +
      '<h2 class="pwa-modal-title">' + c.title + '</h2>' +
      '<p class="pwa-modal-subtitle">' + c.subtitle + '</p>' +
      '<ol class="pwa-modal-steps">' + stepsHtml + '</ol>' +
      '<div class="pwa-modal-tip">' + c.tip + '</div>' +
      '<button type="button" class="pwa-modal-cta" data-close>Compris</button>' +
    '</div>';

  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if(e.target === overlay || e.target.hasAttribute('data-close')){
      overlay.classList.add('pwa-modal-out');
      setTimeout(() => overlay.remove(), 250);
    }
  });
}

// Bind
const btn = document.getElementById('installPwaBtn');
if(btn){
  btn.addEventListener('click', openInstallModal);
}

// Lien externe ?pwa=install
if(new URLSearchParams(location.search).get('pwa') === 'install'){
  setTimeout(showInstallInstructions, 800);
}

// Export pour debug
window.PWAInstall = { openInstallModal, PWA_PLATFORM };
