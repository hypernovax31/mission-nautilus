/* Données publiques minimales : aucune réponse, EAN, SKU ou solution ici. */
window.NautilusPalier3 = window.NautilusPalier3 || {};
window.NautilusPalier3.publicState = {
  stages: ['briefing', 'search', 'scan', 'signature', 'complete'],
  hintCostsHours: { rayon: 1, edition: 2, auteur: 4 },
  maxMistakesBeforeSurface: 3,
  messages: {
    wrongBook: 'Le sceau du Nautilus rejette cet ouvrage. La route reste scellée.',
    relay: 'Le poste de navigation est libre. Un membre de ton équipage est temporairement retenu à la surface. Tu peux prendre le relais et poursuivre la mission du Nautilus pendant son blocage.',
    unavailable: "L’ouvrage désigné n’est momentanément plus disponible. Le capitaine prépare une nouvelle piste. La progression de ton équipage est conservée."
  }
};
