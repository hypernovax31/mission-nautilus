/* Moteur client sans secrets. Toute sélection, validation EAN et réponse reste serveur. */
(() => {
  'use strict';
  const api = window.NautilusPalier3 = window.NautilusPalier3 || {};
  const state = { stage: 'briefing', mistakes: 0, hintsUsed: [], pausedUntil: null, sessionId: null };
  const allowedStages = new Set(api.publicState?.stages || []);
  const emit = () => window.dispatchEvent(new CustomEvent('nautilus:palier3-state', { detail: { ...state } }));
  const setStage = stage => { if (!allowedStages.has(stage)) throw new Error('Étape de palier 3 inconnue'); state.stage = stage; emit(); };
  const registerMistake = () => {
    state.mistakes += 1;
    if (state.mistakes >= (api.publicState?.maxMistakesBeforeSurface || 3)) state.stage = 'surface';
    emit();
    return state.mistakes;
  };
  const resetForBookReplacement = () => { state.stage = 'search'; state.mistakes = 0; emit(); };
  const useHint = kind => {
    if (!Object.prototype.hasOwnProperty.call(api.publicState.hintCostsHours, kind)) throw new Error('Indice inconnu');
    if (state.hintsUsed.includes(kind)) throw new Error('Indice déjà utilisé');
    state.hintsUsed.push(kind); emit(); return api.publicState.hintCostsHours[kind];
  };
  api.client = Object.freeze({ state, setStage, registerMistake, resetForBookReplacement, useHint, emit });
  emit();
})();
