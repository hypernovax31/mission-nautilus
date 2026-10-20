/* =============================================================
   CINÉMATIQUE PALIER — palier-cinematic.js v2
   - Compte à rebours 3,2,1,GO cinématographique avant chaque mini-jeu
   - Bords métalliques + clignotement à <10s (1Hz) puis <3s (2Hz)
   Thème: reprise exacte de .hero-title (Mission Nautilus)
   ============================================================= */
(function(){
  'use strict';

  var overlay = null;
  var styleInjected = false;
  function injectStyles(){
    if(styleInjected) return;
    styleInjected = true;
    var css = `
/* --- OVERLAY CINÉMATIQUE --- */
.nautilus-cinematic-overlay{
  position:fixed;inset:0;z-index:99980;
  display:flex;align-items:center;justify-content:center;
  background:
    radial-gradient(120% 120% at 50% 45%, rgba(6,24,38,.88) 0%, rgba(2,8,18,.96) 62%, #020208 100%),
    radial-gradient(90% 70% at 50% 100%, rgba(245,176,39,.07), transparent 60%);
  backdrop-filter:blur(3px);
  opacity:0;transition:opacity .32s ease;
  pointer-events:auto;overflow:hidden;
}
.nautilus-cinematic-overlay.show{opacity:1}
.nautilus-cinematic-overlay.show-out{opacity:0;pointer-events:none;transition:opacity .38s ease}
/* Vignette sombre */
.nautilus-cinematic-overlay::after{
  content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(120% 85% at 50% 50%, transparent 62%, rgba(0,0,0,.72) 100%);
}
/* Cadre métallique — même ADN que button.mission-step::before + card h2 */
.nautilus-cinematic-frame{
  position:absolute;inset:0;pointer-events:none;
  border:14px solid #a87929;
  box-shadow:
    inset 0 0 0 2px #f6d98b,
    inset 0 0 0 6px #5b4016,
    inset 0 0 0 9px #c9973f,
    0 0 0 2px #30200d,
    inset 0 0 40px rgba(0,0,0,.55);
  opacity:.0;transform:scale(1.02);
  transition:opacity .38s ease, transform .45s cubic-bezier(.2,.9,.3,1.15), border-color .32s ease;
}
.nautilus-cinematic-overlay.show .nautilus-cinematic-frame{opacity:1;transform:scale(1)}
.nautilus-cinematic-overlay.go .nautilus-cinematic-frame{
  border-color:#3a8a5a;
  box-shadow:
    inset 0 0 0 2px #bff0c8,
    inset 0 0 0 6px #1a3d26,
    inset 0 0 0 9px #4eaf7a,
    0 0 0 2px #102818,
    0 0 32px rgba(91,255,156,.45), inset 0 0 32px rgba(91,255,156,.18);
}
/* Rivets du cadre — 12 points comme hublot */
.nautilus-cinematic-rivets{
  position:absolute;inset:0;pointer-events:none;border-radius:0;
  background:
    radial-gradient(circle at 6% 6%, #fff0b0 0 3px, #6b4d18 3.2px 4.6px, transparent 4.8px),
    radial-gradient(circle at 25% 3%, #fff0b0 0 3px, #6b4d18 3.2px 4.6px, transparent 4.8px),
    radial-gradient(circle at 50% 2.8%, #fff0b0 0 3px, #6b4d18 3.2px 4.6px, transparent 4.8px),
    radial-gradient(circle at 75% 3%, #fff0b0 0 3px, #6b4d18 3.2px 4.6px, transparent 4.8px),
    radial-gradient(circle at 94% 6%, #fff0b0 0 3px, #6b4d18 3.2px 4.6px, transparent 4.8px),
    radial-gradient(circle at 97% 25%, #fff0b0 0 3px, #6b4d18 3.2px 4.6px, transparent 4.8px),
    radial-gradient(circle at 97% 50%, #fff0b0 0 3px, #6b4d18 3.2px 4.6px, transparent 4.8px),
    radial-gradient(circle at 97% 75%, #fff0b0 0 3px, #6b4d18 3.2px 4.6px, transparent 4.8px),
    radial-gradient(circle at 94% 94%, #fff0b0 0 3px, #6b4d18 3.2px 4.6px, transparent 4.8px),
    radial-gradient(circle at 75% 97%, #fff0b0 0 3px, #6b4d18 3.2px 4.6px, transparent 4.8px),
    radial-gradient(circle at 50% 97.2%, #fff0b0 0 3px, #6b4d18 3.2px 4.6px, transparent 4.8px),
    radial-gradient(circle at 25% 97%, #fff0b0 0 3px, #6b4d18 3.2px 4.6px, transparent 4.8px),
    radial-gradient(circle at 6% 94%, #fff0b0 0 3px, #6b4d18 3.2px 4.6px, transparent 4.8px),
    radial-gradient(circle at 3% 75%, #fff0b0 0 3px, #6b4d18 3.2px 4.6px, transparent 4.8px),
    radial-gradient(circle at 3% 50%, #fff0b0 0 3px, #6b4d18 3.2px 4.6px, transparent 4.8px),
    radial-gradient(circle at 3% 25%, #fff0b0 0 3px, #6b4d18 3.2px 4.6px, transparent 4.8px);
  opacity:.92;
}
.nautilus-cinematic-overlay.go .nautilus-cinematic-rivets{
  filter:hue-rotate(78deg) brightness(1.08);
}
/* Sonar derrière le chiffre */
.nautilus-cinematic-sonar{
  position:absolute;left:50%;top:50%;width:min(86vmin, 620px);height:min(86vmin, 620px);
  transform:translate(-50%,-50%);pointer-events:none;opacity:.38;
}
.nautilus-cinematic-sonar i{
  position:absolute;inset:0;border:2px solid rgba(142,231,255,.45);border-radius:50%;
  opacity:0;transform:scale(.45);
}
.nautilus-cinematic-overlay.counting .nautilus-cinematic-sonar i{
  animation: nautilusSonarPing 1.15s ease-out infinite;
}
.nautilus-cinematic-sonar i:nth-child(2){animation-delay:.38s}
.nautilus-cinematic-sonar i:nth-child(3){animation-delay:.76s}
@keyframes nautilusSonarPing{
  0%{opacity:.55;transform:scale(.45)}
  100%{opacity:0;transform:scale(1.18)}
}

/* CHIFFRE — clone exact du H1 Mission Nautilus */
.nautilus-cinematic-number{
  position:relative;z-index:2;
  font-family:Impact,Haettenschweiler,"Arial Black",sans-serif;
  font-weight:900;
  font-size:clamp(150px, 38vmin, 520px);
  line-height:.86;
  letter-spacing:.012em;
  text-transform:uppercase;
  color:#f4f4f4;
  -webkit-text-stroke:clamp(3px, .95vmin, 7px) #050505;
  text-shadow:
    4px 4px 0 #050505,
    9px 9px 0 rgba(0,0,0,.55),
    0 0 22px rgba(255,255,255,.14);
  filter:contrast(1.12);
  transform:scale(.22) rotate(-4deg);
  opacity:0;
  will-change:transform, opacity, filter;
}
.nautilus-cinematic-number::after{
  content:"";position:absolute;inset:-6% -4%;pointer-events:none;
  background:radial-gradient(circle at 12% 22%,rgba(0,0,0,.9) 0 1.6px,transparent 2.2px),radial-gradient(circle at 38% 66%,rgba(0,0,0,.85) 0 1.3px,transparent 2.2px),radial-gradient(circle at 73% 36%,rgba(0,0,0,.8) 0 1.5px,transparent 2.2px),repeating-linear-gradient(8deg,transparent 0 9px,rgba(0,0,0,.24) 10px 11px);
  background-size:38px 34px,52px 48px,44px 40px,100% 100%;
  mix-blend-mode:multiply;opacity:.42;
}
/* teintes */
.nautilus-cinematic-number.red{
  color:#ff3b30;
  -webkit-text-stroke:clamp(3px, .95vmin, 7px) #1a0705;
  text-shadow:
    5px 5px 0 #1a0705,
    10px 10px 0 rgba(0,0,0,.58),
    0 0 28px rgba(255,59,48,.55),
    0 0 42px rgba(255,59,48,.28);
}
.nautilus-cinematic-number.green{
  color:#5bff9c;
  font-size:clamp(110px, 28vmin, 420px);
  -webkit-text-stroke:clamp(3px, .85vmin, 6px) #0a1f14;
  text-shadow:
    5px 5px 0 #0a1f14,
    10px 10px 0 rgba(0,0,0,.55),
    0 0 30px rgba(91,255,156,.65),
    0 0 52px rgba(91,255,156,.32);
}
/* animations */
.nautilus-cinematic-number.in{
  animation: nautilusPopIn .52s cubic-bezier(.16,.88,.32,1.35) forwards;
}
.nautilus-cinematic-number.out{
  animation: nautilusPopOut .32s cubic-bezier(.6,-.2,.78,.42) forwards;
}
@keyframes nautilusPopIn{
  0%{transform:scale(.22) rotate(-6deg);opacity:0;filter:contrast(1.12) brightness(.85) blur(6px)}
  58%{transform:scale(1.14) rotate(1.2deg);opacity:1;filter:contrast(1.18) brightness(1.08) blur(0)}
  78%{transform:scale(.96) rotate(-.6deg)}
  100%{transform:scale(1) rotate(0);opacity:1;filter:contrast(1.12) brightness(1)}
}
@keyframes nautilusPopOut{
  0%{transform:scale(1) rotate(0);opacity:1;filter:blur(0)}
  100%{transform:scale(1.38) rotate(2deg);opacity:0;filter:blur(10px) brightness(1.35)}
}
/* Sous-titre GO */
.nautilus-cinematic-sub{
  position:absolute;left:50%;bottom:12%;transform:translateX(-50%);
  z-index:3;font:900 clamp(12px,2.2vmin,18px)/1 "Consolas","Courier New",monospace;
  letter-spacing:.32em;color:rgba(255,242,180,.92);text-transform:uppercase;
  background:rgba(0,0,0,.45);border:1px solid rgba(245,176,39,.35);border-radius:999px;
  padding:8px 14px;opacity:0;transition:opacity .3s ease;
  text-shadow:0 1px 6px rgba(0,0,0,.8);
}
.nautilus-cinematic-overlay.go .nautilus-cinematic-sub{opacity:1}

@media(max-width:640px){
  .nautilus-cinematic-frame{border-width:10px}
  .nautilus-cinematic-rivets{opacity:.78}
  .nautilus-cinematic-number{font-size:clamp(120px, 42vmin, 380px)}
  .nautilus-cinematic-number.green{font-size:clamp(92px, 32vmin, 300px)}
}
@media(max-width:380px){
  .nautilus-cinematic-frame{border-width:8px}
}

/* --- BORDS MÉTALLIQUES DE FIN DE CHRONO --- */
.nautilus-edge-flash{
  position:fixed;inset:0;z-index:9996;pointer-events:none;
  border:12px solid #a87929;
  box-shadow:
    inset 0 0 0 2px #f6d98b,
    inset 0 0 0 5px #5b4016,
    inset 0 0 0 8px #c9973f,
    0 0 0 2px #30200d;
  opacity:0;transition:opacity .14s ease;
}
.nautilus-edge-flash::after{
  content:"";position:absolute;inset:0;pointer-events:none;
  background:
    radial-gradient(circle at 50% 3%, #fff0b0 0 2px, #6b4d18 2.1px 3.2px, transparent 3.4px),
    radial-gradient(circle at 88% 8%, #fff0b0 0 2px, #6b4d18 2.1px 3.2px, transparent 3.4px),
    radial-gradient(circle at 97% 22%, #fff0b0 0 2px, #6b4d18 2.1px 3.2px, transparent 3.4px),
    radial-gradient(circle at 98% 50%, #fff0b0 0 2px, #6b4d18 2.1px 3.2px, transparent 3.4px),
    radial-gradient(circle at 97% 78%, #fff0b0 0 2px, #6b4d18 2.1px 3.2px, transparent 3.4px),
    radial-gradient(circle at 88% 92%, #fff0b0 0 2px, #6b4d18 2.1px 3.2px, transparent 3.4px),
    radial-gradient(circle at 50% 97%, #fff0b0 0 2px, #6b4d18 2.1px 3.2px, transparent 3.4px),
    radial-gradient(circle at 12% 92%, #fff0b0 0 2px, #6b4d18 2.1px 3.2px, transparent 3.4px),
    radial-gradient(circle at 3% 78%, #fff0b0 0 2px, #6b4d18 2.1px 3.2px, transparent 3.4px),
    radial-gradient(circle at 2% 50%, #fff0b0 0 2px, #6b4d18 2.1px 3.2px, transparent 3.4px),
    radial-gradient(circle at 3% 22%, #fff0b0 0 2px, #6b4d18 2.1px 3.2px, transparent 3.4px),
    radial-gradient(circle at 12% 8%, #fff0b0 0 2px, #6b4d18 2.1px 3.2px, transparent 3.4px);
  opacity:.95;
}
.nautilus-edge-flash.warn{
  border-color:#c0392b;
  box-shadow:
    inset 0 0 0 2px #ffd0c8,
    inset 0 0 0 5px #5b1a14,
    inset 0 0 0 8px #e74c3c,
    0 0 0 2px #2a0a08,
    0 0 22px rgba(231,76,60,.55), inset 0 0 22px rgba(231,76,60,.22);
}
.nautilus-edge-flash.crit{
  border-color:#ff3b30;
  box-shadow:
    inset 0 0 0 2px #ffe0dd,
    inset 0 0 0 5px #5b1a14,
    inset 0 0 0 8px #ff3b30,
    0 0 0 2px #2a0a08,
    0 0 32px rgba(255,59,48,.75), inset 0 0 32px rgba(255,59,48,.32);
}
.nautilus-edge-flash.on{opacity:1}
@media(max-width:600px){.nautilus-edge-flash{border-width:8px}}
`;
    var st = document.createElement('style');
    st.id = 'nautilus-cinematic-styles';
    st.textContent = css;
    (document.head||document.documentElement).appendChild(st);
  }

  function ensureOverlay(){
    injectStyles();
    if(!overlay){
      overlay = document.createElement('div');
      overlay.className = 'nautilus-cinematic-overlay';
      overlay.setAttribute('aria-hidden','true');
      overlay.innerHTML = ''
        + '<div class="nautilus-cinematic-frame" aria-hidden="true"></div>'
        + '<div class="nautilus-cinematic-rivets" aria-hidden="true"></div>'
        + '<div class="nautilus-cinematic-sonar" aria-hidden="true"><i></i><i></i><i></i></div>'
        + '<div class="nautilus-cinematic-number" id="nautilusCinematicNumber"></div>'
        + '<div class="nautilus-cinematic-sub" id="nautilusCinematicSub">PLONGÉE IMMINENTE</div>';
      document.body.appendChild(overlay);
      if(!document.getElementById('nautilusEdgeFlash')){
        var ef = document.createElement('div');
        ef.id = 'nautilusEdgeFlash';
        ef.className = 'nautilus-edge-flash';
        ef.setAttribute('aria-hidden','true');
        document.body.appendChild(ef);
      }
    }
    return overlay;
  }

  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  // Lance le jeu PENDANT que GO est à l'écran → zéro délai perçu
  async function playCountdown(launchFn){
    var ov = ensureOverlay();
    var numEl = document.getElementById('nautilusCinematicNumber');
    var subEl = document.getElementById('nautilusCinematicSub');
    // Réinitialise l'état
    ov.classList.remove('show-out','go','counting');
    void ov.offsetWidth;
    ov.classList.add('show');
    ov.classList.add('counting');
    if(subEl) subEl.textContent = 'PLONGÉE IMMINENTE';
    await sleep(160);

    var seq = [
      {txt:'3', cls:'red', hold:780},
      {txt:'2', cls:'red', hold:780},
      {txt:'1', cls:'red', hold:780},
      {txt:'GO', cls:'green', hold:950}
    ];
    for(var i=0;i<seq.length;i++){
      var s = seq[i];
      var isGo = s.txt==='GO';
      if(isGo){
        ov.classList.add('go');
        ov.classList.remove('counting');
        if(subEl) subEl.textContent = '⚓ EN PLONGÉE';
      }
      numEl.textContent = s.txt;
      numEl.className = 'nautilus-cinematic-number ' + s.cls;
      void numEl.offsetWidth;
      numEl.classList.add('in');
      // Si GO : déclenche le mini-jeu 260ms après l'apparition (au pic de l'anim)
      if(isGo && typeof launchFn==='function'){
        await sleep(260);
        try{ launchFn(); }catch(e){ console.error(e); }
        // GO reste visible le temps de révéler la page dessous
        await sleep(s.hold - 260);
      } else {
        await sleep(s.hold);
      }
      numEl.classList.remove('in');
      numEl.classList.add('out');
      await sleep(220);
      numEl.classList.remove('out');
      numEl.className = 'nautilus-cinematic-number';
    }
    // fondu ultra court : la page est déjà rendue dessous
    ov.classList.add('show-out');
    ov.classList.remove('show','go','counting');
    await sleep(360);
    ov.classList.remove('show-out');
  }

  function withCountdown(fn){
    return function(){
      var args = arguments;
      var self = this;
      if(overlay && overlay.classList.contains('show')) return;
      playCountdown(function(){ try{ fn.apply(self, args); }catch(e){ console.error(e); } });
    };
  }

  // ---- EDGE FLASH MÉTALLIQUE ----
  var edgeFlashEl = null;
  var edgeInterval = null;
  var edgeTimeout = null;
  var lastRemaining = null;

  function getEdgeEl(){
    if(edgeFlashEl) return edgeFlashEl;
    edgeFlashEl = document.getElementById('nautilusEdgeFlash');
    if(!edgeFlashEl){
      injectStyles();
      edgeFlashEl = document.createElement('div');
      edgeFlashEl.id = 'nautilusEdgeFlash';
      edgeFlashEl.className = 'nautilus-edge-flash';
      document.body.appendChild(edgeFlashEl);
    }
    return edgeFlashEl;
  }

  function stopEdgeFlash(){
    var el = getEdgeEl();
    el.classList.remove('on','warn','crit');
    if(edgeInterval){ clearInterval(edgeInterval); edgeInterval=null; }
    if(edgeTimeout){ clearTimeout(edgeTimeout); edgeTimeout=null; }
    lastRemaining = null;
  }

  function startEdgeFlash(){
    var el = getEdgeEl();
    if(edgeInterval) return;
    function tick(){
      var rem = lastRemaining;
      if(rem==null || rem>10 || rem<=0){
        stopEdgeFlash();
        return;
      }
      var isCrit = rem <= 3;
      el.className = 'nautilus-edge-flash ' + (isCrit ? 'crit' : 'warn');
      el.classList.add('on');
      edgeTimeout = setTimeout(function(){
        el.classList.remove('on');
      }, isCrit ? 260 : 340);
    }
    tick();
    edgeInterval = setInterval(tick, lastRemaining<=3?500:1000);
  }

  function updateEdgeFlash(remainingSec){
    lastRemaining = remainingSec;
    if(remainingSec<=10 && remainingSec>0){
      var el = getEdgeEl();
      el.classList.toggle('crit', remainingSec<=3);
      el.classList.toggle('warn', remainingSec>3);
      if(!edgeInterval){
        startEdgeFlash();
        if(remainingSec<=3 && edgeInterval){
          clearInterval(edgeInterval); edgeInterval=null; startEdgeFlash();
        }
      } else if(remainingSec<=3){
        clearInterval(edgeInterval); edgeInterval=null;
        startEdgeFlash();
      }
    } else {
      stopEdgeFlash();
    }
  }

  var watchHandle = null;
  function watchTimer(getRemainingFn){
    if(watchHandle) clearInterval(watchHandle);
    watchHandle = setInterval(function(){
      try{
        var rem = getRemainingFn();
        if(typeof rem==='number' && !isNaN(rem)){
          updateEdgeFlash(Math.ceil(rem));
        }
      }catch(e){}
    }, 250);
    return function(){ if(watchHandle){ clearInterval(watchHandle); watchHandle=null; stopEdgeFlash(); } };
  }

  function autoWatchFromDom(){
    var getRem = function(){
      var el = document.getElementById('gameCardTimerVal') || document.querySelector('[id*="TimerVal"]') || document.querySelector('.card-h2-timer');
      if(!el) return null;
      var txt = (el.textContent||'').trim();
      var m = txt.match(/(\d+):(\d+)/);
      if(m){ return parseInt(m[1],10)*60 + parseInt(m[2],10); }
      return null;
    };
    return watchTimer(getRem);
  }

  window.NautilusCinematic = {
    playCountdown: playCountdown,
    withCountdown: withCountdown,
    updateEdgeFlash: updateEdgeFlash,
    stopEdgeFlash: stopEdgeFlash,
    watchTimer: watchTimer,
    autoWatchFromDom: autoWatchFromDom
  };
})();
