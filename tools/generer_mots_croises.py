#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GÉNÉRATEUR DE LA GRILLE DE MOTS CROISÉS — Palier 2 « Code Magasin ».

Entrée  : MOTS_CANDIDATS ci-dessous — 10 mots du JARGON VENDEUR couvrant
          TOUS les secteurs : rayon, stock, SAV, bureau, caisse,
          billetterie, occasion et direction (niveau expert par secteur).
Sortie  : le tableau JS `var MOTS = [...]` prêt à coller dans 1721310619.html,
          avec (num, dir, row, col) calculés et la grille rendue en ASCII.

ANTI-IA — deux chiffrements alternés (plus de recombinaison de lettres) :
  - « à reculons »  : la solution épelée de DROITE À GAUCHE (GNICAF) ;
  - « miroir »      : ALPHABET INVERSÉ, A↔Z … M↔N (UZXRMT).
  Un humain décode à vue ; un LLM se trompe dans les transformations
  caractère par caractère dès 6-7 lettres (faiblesse connue), et la
  grille rejette toute lettre fautive. Chaque indice métier sert de
  CONFIRMATION au joueur, jamais de réponse directe.
  Le script VÉRIFIE que chaque cryptogramme décode EXACTEMENT la solution
  et que la solution n'apparaît NULLE PART en clair dans la définition.

Règles de construction (mots croisés classiques) :
  - chaque mot croise AU MOINS un autre mot (grille entièrement connexe) ;
  - tout croisement est vérifié LETTRE PAR LETTRE ;
  - aucune touche illégale : hors croisement, deux cases de mots différents
    ne sont jamais voisines orthogonales ; un blanc encadre chaque extrémité ;
  - cadre dur ≤ 13×13 (lisible sur mobile) ; objectif : max de croisements.

Usage : PYTHONUTF8=1 python3 tools/generer_mots_croises.py
"""
import unicodedata
from collections import Counter

# ---------------------------------------------------------------
# Les 10 mots « jargon maison » — un niveau EXPERT par secteur.
#   reponse : solution (sans accents)   mode : 'reculons' | 'miroir'
#   secteur : rayon / stock / sav / bureau / caisse / billetterie /
#             occasion / direction       indice : confirmation métier
# ---------------------------------------------------------------
MOTS_CANDIDATS = [
    dict(reponse='INVENTAIRE', secteur='bureau',      mode='miroir',
         indice="une fois l'an, tout le magasin compté pièce par pièce, scanner en main"),
    dict(reponse='LINEAIRE',   secteur='rayon',       mode='miroir',
         indice="ses précieux centimètres se marchandent entre rayons rivaux"),
    dict(reponse='REASSORT',   secteur='stock',       mode='miroir',
         indice="le va-et-vient de la réserve vers le rayon avant le rush du samedi"),
    dict(reponse='DEMARQUE',   secteur='direction',   mode='miroir',
         indice="additionnée à l'inconnue, elle donne des sueurs froides au chef de rayon le jour du comptage"),
    dict(reponse='GARANTIE',   secteur='sav',         mode='reculons',
         indice="deux ans minimum : la promesse du comptoir qui désamorce les colères"),
    dict(reponse='ARRIVAGE',   secteur='stock',       mode='miroir',
         indice="le camion du matin que le quai attend pour nourrir les rayons"),
    dict(reponse='PREVENTE',   secteur='billetterie', mode='reculons',
         indice="les billets vendus avant même l'affiche du concert"),
    dict(reponse='ECOTAXE',    secteur='caisse',      mode='reculons',
         indice="la petite ligne verte déjà réglée sur le ticket de caisse"),
    dict(reponse='REPRISE',    secteur='occasion',    mode='miroir',
         indice="ton ancien mobile quitte ta poche contre un bon d'achat"),
    dict(reponse='FACING',     secteur='rayon',       mode='reculons',
         indice="le rituel de l'ouverture : chaque article face au client, étiquette tirée au bord"),
]
NB_MOTS = len(MOTS_CANDIDATS)
CIBLE_CROISEMENTS = 9

def normaliser(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn').upper()

def miroir(mot):
    """Alphabet inversé : A↔Z, B↔Y … (Atbash latin)."""
    return ''.join(chr(ord('A') + 25 - (ord(c) - ord('A'))) for c in mot)

def crypter(mot, mode):
    mot = normaliser(mot)
    return mot[::-1] if mode == 'reculons' else miroir(mot)

def decrypter(crypto, mode):
    return crypto[::-1] if mode == 'reculons' else miroir(crypto)

MODE_TXT = {'reculons': 'relu à reculons',
            'miroir':   'lu en alphabet miroir (A↔Z)'}

def fabriquer_definition(c):
    """Définition joueur : cryptogramme + mode + indice métier + secteur."""
    crypto = crypter(c['reponse'], c['mode'])
    return ('« <code class="mc-code">%s</code>, %s » : %s. (%s)'
            % (crypto, MODE_TXT[c['mode']], c['indice'], c['secteur']))

def verifier_candidat(c):
    """Garde-fous : décodage exact + aucune fuite de la solution en clair."""
    sol = normaliser(c['reponse'])
    defin = fabriquer_definition(c)
    if decrypter(crypter(sol, c['mode']), c['mode']) != sol:
        return False, 'cryptogramme non réversible'
    propre = normaliser(defin.split('»')[1])   # texte hors citation
    if sol in propre:
        return False, 'solution en clair dans l\'indice'
    if c['secteur'] not in ('rayon', 'stock', 'sav', 'bureau', 'caisse',
                            'billetterie', 'occasion', 'direction'):
        return False, 'secteur inconnu'
    return True, ''

# ---------------------------------------------------------------
# Solveur : placement par retour sur trace, règles strictes.
# ---------------------------------------------------------------
class Solveur:
    def __init__(self, mots):
        self.mots = sorted([normaliser(m) for m in mots], key=len, reverse=True)
        self.meilleur = None          # (score, placements, cellules)
        self.noeuds = 0
        self.MAX_NOEUDS = 2_000_000

    def score(self, placements, cellules, croisements):
        rs = [r for (r, c) in cellules]; cs = [c for (r, c) in cellules]
        haut = max(rs) - min(rs) + 1
        larg = max(cs) - min(cs) + 1
        aire = haut * larg
        return (croisements * 1000) - aire - 2 * abs(haut - larg)

    def placements_possibles(self, mot, placements, cellules, proprietaires):
        """Tous les placements valides croisant ≥1 mot posé (sauf 1er mot)."""
        out = []
        premier = not placements
        if premier:
            # le 1er mot est toujours posé horizontal à l'origine : toute
            # grille avec 1er mot vertical se transpose (cadre symétrique
            # ≤13×13) — ça divise l'espace de recherche par deux.
            return [(0, (mot, 'h', 0, 0))]
        for sens in ('h', 'v'):
            for i, lettre in enumerate(mot):
                for (r, c) in sorted(cellules):
                    if cellules[(r, c)] != lettre:
                        continue
                    # la case cible doit appartenir à un mot PERPENDICULAIRE
                    if not any(p[2] != sens and couvre(p, r, c) for p in placements):
                        continue
                    r0, c0 = (r, c - i) if sens == 'h' else (r - i, c)
                    cand = (mot, sens, r0, c0)
                    nb_crois, ok = self.valide(cand, cellules, proprietaires)
                    if ok and (premier or nb_crois >= 1):
                        out.append((nb_crois, cand))
        out.sort(key=lambda x: -x[0])
        return out

    def valide(self, cand, cellules, proprietaires):
        mot, sens, r0, c0 = cand
        dr, dc = (0, 1) if sens == 'h' else (1, 0)
        pr, pc = dc, dr  # perpendiculaire
        nb_crois = 0
        # extrémités encadrées de vide
        for (r, c) in ((r0 - dr, c0 - dc), (r0 + dr * len(mot), c0 + dc * len(mot))):
            if (r, c) in cellules:
                return 0, False
        for i, lettre in enumerate(mot):
            r, c = r0 + dr * i, c0 + dc * i
            if (r, c) in cellules:
                if cellules[(r, c)] != lettre:
                    return 0, False
                if any(s == sens for s in proprietaires[(r, c)]):
                    return 0, False          # superposition interdite
                nb_crois += 1
            else:
                # voisins perpendiculaires vides
                if (r + pr, c + pc) in cellules or (r - pr, c - pc) in cellules:
                    return 0, False
        return nb_crois, True

    def resoudre(self, idx, placements, cellules, proprietaires, croisements):
        self.noeuds += 1
        if self.noeuds > self.MAX_NOEUDS:
            return
        if idx == len(self.mots):
            rs = [r for (r, c) in cellules]; cs = [c for (r, c) in cellules]
            if max(rs) - min(rs) + 1 > 13 or max(cs) - min(cs) + 1 > 13:
                return   # cadre dur : la grille doit tenir dans 13×13 (mobile)
            sc = self.score(placements, cellules, croisements)
            if self.meilleur is None or sc > self.meilleur[0]:
                self.meilleur = (sc, list(placements), dict(cellules), croisements)
            return
        # élagage : même avec un croisement par mot restant, peut-on battre ?
        if self.meilleur:
            borne = self.score(placements, cellules,
                               croisements + 3 * (len(self.mots) - idx))
            if borne < self.meilleur[0]:
                return
        mot = self.mots[idx]
        for nb_crois, cand in self.placements_possibles(mot, placements, cellules, proprietaires)[:20]:
            mot2, sens, r0, c0 = cand
            dr, dc = (0, 1) if sens == 'h' else (1, 0)
            ajouts = []
            for i, lettre in enumerate(mot2):
                r, c = r0 + dr * i, c0 + dc * i
                if (r, c) not in cellules:
                    cellules[(r, c)] = lettre
                    proprietaires[(r, c)] = []
                    ajouts.append((r, c))
                proprietaires[(r, c)].append(sens)
            placements.append(cand)
            # élague tôt : le cadre courant ne fait que GRANDIR —
            # s'il dépasse déjà 13×13, toute la branche est stérile.
            rs = [r for (r, c) in cellules]; cs = [c for (r, c) in cellules]
            if max(rs) - min(rs) + 1 <= 13 and max(cs) - min(cs) + 1 <= 13:
                self.resoudre(idx + 1, placements, cellules, proprietaires,
                              croisements + nb_crois)
            placements.pop()
            for (r, c) in ajouts:
                del cellules[(r, c)]
                del proprietaires[(r, c)]

def couvre(p, r, c):
    mot, sens, r0, c0 = p
    if sens == 'h':
        return r == r0 and c0 <= c < c0 + len(mot)
    return c == c0 and r0 <= r < r0 + len(mot)

# ---------------------------------------------------------------
# Numérotation classique : balayage ligne puis colonne, un numéro
# à chaque case qui démarre au moins un mot (h et/ou v).
# ---------------------------------------------------------------
def numeroter(placements):
    departs = {}
    for (mot, sens, r, c) in placements:
        departs.setdefault((r, c), []).append(sens)
    rs = [r for (r, c) in departs]; cs = [c for (r, c) in departs]
    rmin, cmin = min(rs), min(cs)
    # décale l'origine en (0,0) — départs uniquement, la bounding box
    # complète est recalée après rendu.
    numeros = {}
    n = 0
    for (r, c) in sorted(departs):
        if (r, c) not in numeros:
            n += 1
            numeros[(r, c)] = n
    # renumérotation propre : scan row-major = déjà le tri, ok.
    mot_infos = []
    for (mot, sens, r, c) in placements:
        mot_infos.append({
            'reponse': mot, 'dir': sens,
            'row': r - rmin, 'col': c - cmin,
            'num': numeros[(r, c)],
        })
    mot_infos.sort(key=lambda m: (m['row'], m['col'], m['dir']))
    return mot_infos, (rmin, cmin)

# ---------------------------------------------------------------
def rendre_ascii(cellules, dec):
    rmin, cmin = dec
    rs = [r for (r, c) in cellules]; cs = [c for (r, c) in cellules]
    lignes = []
    for r in range(min(rs), max(rs) + 1):
        ligne = ' '.join(cellules.get((r, c), '·')
                         for c in range(min(cs), max(cs) + 1))
        lignes.append(ligne)
    return lignes

def main():
    # 1) verrous anti-IA : décodage exact + aucune fuite en clair
    print('=== Vérification des cryptogrammes (anti-IA) ===')
    for c in MOTS_CANDIDATS:
        ok, detail = verifier_candidat(c)
        print(f"  {'✓' if ok else '✗'} {normaliser(c['reponse']):<11} "
              f"{c['mode']:<9} → {crypter(c['reponse'], c['mode'])}")
        if not ok:
            raise SystemExit(f"CRYPTOGRAMME FAUX pour {c['reponse']} : {detail}")
    couverture = sorted({c['secteur'] for c in MOTS_CANDIDATS})
    print(f'  ✓ couverture secteurs ({len(couverture)}): ' + ', '.join(couverture))
    # 2) solveur : toutes les réponses, cadre ≤ 13×13, max de croisements
    selection = [c['reponse'] for c in MOTS_CANDIDATS]
    solveur = Solveur(selection)
    solveur.resoudre(0, [], {}, {}, 0)
    if not solveur.meilleur:
        raise SystemExit('Aucune grille trouvée dans le cadre 13×13.')
    score, placements, cellules, croisements = solveur.meilleur
    print(f'  solveur : {croisements} croisements, {solveur.noeuds} nœuds')
    par_reponse = {normaliser(c['reponse']): c for c in MOTS_CANDIDATS}
    mot_infos, dec = numeroter(placements)
    print()
    print(f'=== Grille retenue : {selection} ===')
    print(f'croisements={croisements}  cases={len(cellules)}  '
          f'cadre={max(r for r, c in cellules) - dec[0] + 1}×'
          f'{max(c for r, c in cellules) - dec[1] + 1}  nœuds={solveur.noeuds}')
    lignes = rendre_ascii(cellules, dec)
    for lg in lignes:
        print('  ' + lg)
    # 3) vérification lettre par lettre de CHAQUE croisement (post-check)
    print()
    print('=== Contrôle croisements (lettre par lettre) ===')
    nb_x = 0
    for a in range(len(placements)):
        for b in range(a + 1, len(placements)):
            (ma, sa, ra, ca) = placements[a]
            (mb, sb, rb, cb) = placements[b]
            for i, la in enumerate(ma):
                r1 = ra + (i if sa == 'v' else 0); c1 = ca + (i if sa == 'h' else 0)
                for j, lb in enumerate(mb):
                    r2 = rb + (j if sb == 'v' else 0); c2 = cb + (j if sb == 'h' else 0)
                    if (r1, c1) == (r2, c2):
                        nb_x += 1
                        assert la == lb, f'CROISEMENT FAUX {ma}×{mb} en {(r1, c1)}: {la}≠{lb}'
                        print(f'  ✓ {ma}({i}) × {mb}({j}) = {la} en ({r1 - dec[0]},{c1 - dec[1]})')
    assert nb_x == croisements
    # 4) sortie JS prête à coller
    print()
    print('=== var MOTS = [...] (à coller dans 1721310619.html) ===')
    print('  var MOTS = [')
    lignes_js = []
    for m in mot_infos:
        c = par_reponse[normaliser(m['reponse'])]
        defin = fabriquer_definition(c)
        lignes_js.append(
            '    { num: %d, dir: \'%s\', row: %d, col: %d, reponse: \'%s\', secteur: \'%s\', definition: "%s" }'
            % (m['num'], m['dir'], m['row'], m['col'], normaliser(m['reponse']),
               c['secteur'], defin.replace(chr(34), chr(92) + chr(34))))
    print(',\n'.join(lignes_js))
    print('  ];')

if __name__ == '__main__':
    main()
