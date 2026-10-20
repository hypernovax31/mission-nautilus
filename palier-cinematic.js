/* =============================================================
   CINÉMATIQUE PALIER — palier-cinematic.js
   - Compte à rebours 3,2,1,GO avant chaque mini-jeu
   - Clignotement des bords à <10s (1Hz) puis <3s (2Hz)
   ============================================================= */
(function(){
  'use strict';

  // ---- COUNTDOWN ----
  var overlay = null;
  var styleInjected = false;
  function injectStyles(){
    if(styleInjected) return;
    styleInjected = true;
    var css = `
.nautilus-cinematic-overlay{position:fixed;inset:0;z-index:99980;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.78);backdrop-filter:blur(2px);opacity:0;transition:opacity .28s ease;pointer-events:auto;}
.nautilus-cinematic-overlay.show{opacity:1}
.nautilus-cinematic-number{font-family:Impact,Haettenschweiler,'Arial Black',sans-serif;font-size:clamp(80px, 18vmin, 180px);font-weight:900;line-height:1;letter-spacing:.06em;text-shadow:0 4px 0 rgba(0,0,0,.6),0 8px 24px rgba(0,0,0,.55);transform:scale(.6);opacity:0;transition:transform .38s cubic-bezier(.2,.9,.3,1.2), opacity .28s ease;}
.nautilus-cinematic-number.in{transform:scale(1.08);opacity:1}
.nautilus-cinematic-number.out{transform:scale(1.25);opacity:0}
.nautilus-cinematic-number.red{color:#ff3b30;text-shadow:0 4px 0 rgba(0,0,0,.6),0 8px 24px rgba(0,0,0,.55),0 0 28px rgba(255,59,48,.55);}
.nautilus-cinematic-number.green{color:#5bff9c;text-shadow:0 4px 0 rgba(0,0,0,.6),0 8px 24px rgba(0,0,0,.55),0 0 28px rgba(91,255,156,.65);}
.nautilus-edge-flash{position:fixed;inset:0;z-index:9997;pointer-events:none;border:8px solid #ff3b30;box-shadow:0 0 24px rgba(255,59,48,.85), inset 0 0 24px rgba(255,59,48,.45);opacity:0;transition:opacity .12s ease;}
.nautilus-edge-flash.on{opacity:1}
@media (max-width:600px){.nautilus-edge-flash{border-width:6px}}
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
      overlay.innerHTML = '<div class="nautilus-cinematic-number" id="nautilusCinematicNumber"></div>';
      document.body.appendChild(overlay);
      // ensure edge flash exists
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

  async function playCountdown(){
    var ov = ensureOverlay();
    var numEl = document.getElementById('nautilusCinematicNumber');
    // darken background
    ov.classList.add('show');
    // small delay for fade-in
    await sleep(180);
    var seq = [
      {txt:'3', cls:'red', hold:700},
      {txt:'2', cls:'red', hold:700},
      {txt:'1', cls:'red', hold:700},
      {txt:'GO', cls:'green', hold:820}
    ];
    for(var i=0;i<seq.length;i++){
      var s = seq[i];
      numEl.textContent = s.txt;
      numEl.className = 'nautilus-cinematic-number ' + s.cls;
      // force reflow
      void numEl.offsetWidth;
      numEl.classList.add('in');
      await sleep(s.hold);
      numEl.classList.remove('in');
      numEl.classList.add('out');
      await sleep(180);
      numEl.classList.remove('out');
    }
    ov.classList.remove('show');
    await sleep(280);
    // keep overlay in DOM for reuse
  }

  // Public API: wrap a function with countdown
  function withCountdown(fn){
    return function(){
      var args = arguments;
      var self = this;
      // if already counting down, ignore
      if(overlay && overlay.classList.contains('show')) return;
      playCountdown().then(function(){
        try{ fn.apply(self, args); }catch(e){ console.error(e); }
      });
    };
  }

  // ---- EDGE FLASH ----
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
    el.classList.remove('on');
    if(edgeInterval){ clearInterval(edgeInterval); edgeInterval=null; }
    if(edgeTimeout){ clearTimeout(edgeTimeout); edgeTimeout=null; }
    lastRemaining = null;
  }

  function startEdgeFlash(){
    var el = getEdgeEl();
    // ensure not already flashing
    if(edgeInterval) return;
    // 10s to 4s: 1Hz (on 300ms every 1000ms)
    // 3s to 0: 2Hz (on 260ms every 500ms)
    function tick(){
      var rem = lastRemaining;
      if(rem==null || rem>10 || rem<=0){
        stopEdgeFlash();
        return;
      }
      var isUrgent = rem <= 3;
      var onDur = isUrgent ? 260 : 300;
      var period = isUrgent ? 500 : 1000;
      el.classList.add('on');
      edgeTimeout = setTimeout(function(){
        el.classList.remove('on');
      }, onDur);
      // schedule next tick based on period, but we will re-evaluate remaining each time via interval
    }
    // immediate tick
    tick();
    edgeInterval = setInterval(tick, lastRemaining<=3?500:1000);
    // if we cross 3s threshold, adjust interval
  }

  function updateEdgeFlash(remainingSec){
    lastRemaining = remainingSec;
    if(remainingSec<=10 && remainingSec>0){
      var el = getEdgeEl();
      if(!edgeInterval){
        // start flashing
        startEdgeFlash();
        // if we just entered urgent zone, adjust interval
        if(remainingSec<=3){
          if(edgeInterval){ clearInterval(edgeInterval); edgeInterval=null; startEdgeFlash(); }
        }
      } else {
        // check if we need to switch frequency
        var currentIsUrgent = remainingSec<=3;
        // we track interval period via checking if remaining crossed 3
        // simplify: if we are in urgent and interval is 1000, restart to 500
        // we can detect by checking if interval delay is not matching
        // For now, just restart if needed
        if(currentIsUrgent){
          clearInterval(edgeInterval); edgeInterval=null;
          startEdgeFlash();
        }
      }
    } else {
      stopEdgeFlash();
    }
  }

  // Watcher that polls a getter for remaining seconds
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
    // also provide stop
    return function(){ if(watchHandle){ clearInterval(watchHandle); watchHandle=null; stopEdgeFlash(); } };
  }

  // Auto-watch based on DOM element #gameCardTimerVal or .gameCardTimer
  function autoWatchFromDom(){
    var getRem = function(){
      var el = document.getElementById('gameCardTimerVal') || document.querySelector('[id*="TimerVal"]') || document.querySelector('.card-h2-timer');
      if(!el) return null;
      var txt = (el.textContent||'').trim(); // "03:20" or "00:08"
      var m = txt.match(/(\d+):(\d+)/);
      if(m){
        return parseInt(m[1],10)*60 + parseInt(m[2],10);
      }
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
