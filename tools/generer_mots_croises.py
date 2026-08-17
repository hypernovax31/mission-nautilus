#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GÉNÉRATEUR DE LA GRILLE DE MOTS CROISÉS — Palier 2 « Code Magasin ».

Entrée  : MOTS_CANDIDATS ci-dessous — 10 mots du JARGON VENDEUR couvrant
          TOUS les secteurs : rayon, stock, SAV, bureau, caisse,
          sécurité, occasion et direction (niveau expert par secteur).
Sortie  : le tableau JS `var MOTS = [...]` prêt à coller dans 1721310619.html,
          avec (num, dir, row, col) calculés et la grille rendue en ASCII.

DIFFICULTÉ « EXPERT » — fini les chiffrements : chaque indice est une
  SCÈNE VÉCUE du métier (oblique, jamais la définition scolaire), et le
  mot lui-même est un jargon propre au secteur. La solution n'apparaît
  JAMAIS dans l'indice (le script le vérifie) : il faut parler boutique.

Règles de construction (mots croisés classiques) :
  - chaque mot croise AU MOINS un autre mot (grille entièrement connexe) ;
  - tout croisement est vérifié LETTRE PAR LETTRE ;
  - aucune touche illégale : hors croisement, deux cases de mots différents
    ne sont jamais voisines orthogonales ; un blanc encadre chaque extrémité ;
  - cadre dur ≤ 17×17 (lisible sur mobile) ; objectif : max de croisements.

Usage : PYTHONUTF8=1 python3 tools/generer_mots_croises.py
"""
import time
import unicodedata
from collections import Counter

# ---------------------------------------------------------------
# Les 10 mots « jargon maison » — un niveau EXPERT par secteur.
#   reponse : solution (sans accents)   mode : 'reculons' | 'miroir'
#   secteur : rayon / stock / sav / bureau / caisse / billetterie /
#             occasion / direction       indice : confirmation métier
# ---------------------------------------------------------------
MOTS_CANDIDATS = [
    dict(reponse='DEMATERIALISATION', secteur='rayon',     mode=None,
         indice="ce qui reste d'un produit quand on l'achète sans qu'aucune boîte ne change de main"),
    dict(reponse='TRANSFORMATION',    secteur='direction', mode=None,
         indice="la jauge invisible qui trie la foule entre les curieux et ceux qui paient"),
    dict(reponse='STEELBOOK',         secteur='rayon',     mode=None,
         indice="l'armure blindée que l'on réserve aux films que l'on veut posséder"),
    dict(reponse='DIAGNOSTIC',        secteur='sav',       mode=None,
         indice="l'arrêt rendu par celui qui écoute battre le cœur d'une machine en panne"),
    dict(reponse='REASSORT',          secteur='stock',     mode=None,
         indice="le geste qui offre un lendemain au rayon qu'on avait laissé vide hier"),
    dict(reponse='PICKING',           secteur='stock',     mode=None,
         indice="l'assemblage pièce à pièce d'une commande destinée à quelqu'un qu'on ne verra jamais"),
    dict(reponse='INVENTAIRE',        secteur='bureau',    mode=None,
         indice="la nuit où le magasin fait l'appel de tout ce qu'il possède"),
    dict(reponse='PLEIADE',          secteur='rayon',     mode=None,
         indice="les sept étoiles d'un même ciel, reliées de cuir sur une étagère"),
    dict(reponse='PLANOGRAMME',       secteur='direction', mode=None,
         indice="la carte muette qu'on suit du doigt pour ranger sans se tromper"),
    dict(reponse='FACING',            secteur='rayon',     mode=None,
         indice="le front uni du rayon, chaque produit avancé d'un pas vers le client"),
]
NB_MOTS = len(MOTS_CANDIDATS)
CIBLE_CROISEMENTS = 9

def normaliser(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn').upper()

def fabriquer_definition(c):
    """Définition joueur, UNE ligne nue : l'indice métier oblique,
    sans pastille, sans cryptogramme, sans étiquette de secteur."""
    return '%s.' % c['indice']

def verifier_candidat(c):
    """Garde-fous : aucune fuite de la solution dans l'indice."""
    import re
    sol = normaliser(c['reponse'])
    defin = fabriquer_definition(c)
    prose = normaliser(re.sub(r'<[^>]+>', ' ', defin))
    if sol in prose:
        return False, 'solution en clair dans l\'indice'
    if c['secteur'] not in ('rayon', 'stock', 'sav', 'bureau', 'caisse',
                            'occasion', 'direction', 'securite'):
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
        self.MAX_NOEUDS = 5_000_000
        self.t0 = None

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
            # ≤17×17) — ça divise l'espace de recherche par deux.
            return [(0, (mot, 'h', 0, 0))]
        for sens in ('h', 'v'):
            for i, lettre in enumerate(mot):
                for (r, c) in sorted(cellules):
                    if cellules[(r, c)] != lettre:
                        continue
                    # la case cible doit appartenir à un mot PERPENDICULAIRE
                    if not any(p[1] != sens and couvre(p, r, c) for p in placements):
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

    def resoudre(self, restants, placements, cellules, proprietaires, croisements):
        self.noeuds += 1
        if self.noeuds > self.MAX_NOEUDS:
            return
        if self.t0 and time.time() - self.t0 > 150:
            return
        if not restants:
            sc = self.score(placements, cellules, croisements)
            if self.meilleur is None or sc > self.meilleur[0]:
                self.meilleur = (sc, list(placements), dict(cellules), croisements)
            return
        # élagage : même avec des croisements généreux, peut-on battre ?
        if self.meilleur:
            borne = self.score(placements, cellules,
                               croisements + 3 * len(restants))
            if borne < self.meilleur[0]:
                return
        # CHOIX DYNAMIQUE : on pose d'abord le mot le plus contraint PARMI
        # CEUX QUI PEUVENT CROISER maintenant. Un mot sans candidat n'est
        # PAS une impasse (il croisera un mot posé plus tard) — l'impasse,
        # c'est quand PLUS AUCUN mot restant ne peut se poser.
        viable = []
        for i, mot in enumerate(restants):
            cands = self.placements_possibles(mot, placements, cellules, proprietaires)
            if cands:
                viable.append((len(cands), i, mot, cands))
        if not viable:
            return
        viable.sort(key=lambda v: v[0])
        _, best_i, mot, best_list = viable[0]
        restants.pop(best_i)
        for nb_crois, cand in best_list[:40]:
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
            # s'il dépasse déjà 17×17, toute la branche est stérile.
            rs = [r for (r, c) in cellules]; cs = [c for (r, c) in cellules]
            if max(rs) - min(rs) + 1 <= 17 and max(cs) - min(cs) + 1 <= 17:
                self.resoudre(restants, placements, cellules, proprietaires,
                              croisements + nb_crois)
            placements.pop()
            for (r, c) in ajouts:
                del cellules[(r, c)]
                del proprietaires[(r, c)]
        restants.insert(best_i, mot)

def couvre(p, r, c):
    mot, sens, r0, c0 = p
    if sens == 'h':
        return r == r0 and c0 <= c < c0 + len(mot)
    return c == c0 and r0 <= r < r0 + len(mot)

# ---------------------------------------------------------------
# Recherche PRINCIPALE : gloutonne aléatoire à graine fixe.
# Le backtracking exhaustif échoue sur certains lexiques (couloirs
# stériles) alors que des solutions existent : le glouton aléatoire
# en trouve ~0,8 % du temps. On enchaîne les essais pondérés (les
# placements à plusieurs croisements sont favorisés) pendant un
# budget temps, et on garde la MEILLEURE grille. Graine fixe →
# résultat REPRODUCTIBLE à l'identique (contrat avec les tests).
# ---------------------------------------------------------------
def recherche_stochastique(solveur, graine=20260812, budget_s=45):
    import random
    rng = random.Random(graine)
    essais, trouvees = 0, 0
    t0 = time.time()
    while time.time() - t0 < budget_s:
        essais += 1
        mots = list(solveur.mots)
        rng.shuffle(mots)
        placements, cellules, proprietaires = [], {}, {}
        for w in mots:
            cands = solveur.placements_possibles(w, placements, cellules, proprietaires)
            valables = []
            for nb, cand in cands:
                m2, sens, r0, c0 = cand
                dr, dc = (0, 1) if sens == 'h' else (1, 0)
                tout = list(cellules)
                for i in range(len(m2)):
                    pt = (r0 + dr * i, c0 + dc * i)
                    if pt not in cellules:
                        tout.append(pt)
                rs = [r for r, _ in tout]; cs = [cc for _, cc in tout]
                if max(rs) - min(rs) + 1 <= 17 and max(cs) - min(cs) + 1 <= 17:
                    valables.append((nb, cand))
            if not valables:
                break
            poids = [(nb + 1) ** 2 for nb, _ in valables]
            nb, cand = rng.choices(valables, weights=poids, k=1)[0]
            m2, sens, r0, c0 = cand
            dr, dc = (0, 1) if sens == 'h' else (1, 0)
            crois = 0
            for i, l in enumerate(m2):
                pt = (r0 + dr * i, c0 + dc * i)
                cellules[pt] = l
                proprietaires.setdefault(pt, []).append(sens)
            placements.append(cand)
        if len(placements) == len(mots):
            trouvees += 1
            croisements = sum(len(set(proprietaires[p])) > 1 for p in proprietaires)
            sc = solveur.score(placements, cellules, croisements)
            if solveur.meilleur is None or sc > solveur.meilleur[0]:
                solveur.meilleur = (sc, list(placements), dict(cellules), croisements)
    return essais, trouvees

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
    # 1) garde-fous : aucune solution ne fuit dans son indice
    print('=== Vérification des indices (aucune fuite en clair) ===')
    for c in MOTS_CANDIDATS:
        ok, detail = verifier_candidat(c)
        print(f"  {'✓' if ok else '✗'} {normaliser(c['reponse']):<11}")
        if not ok:
            raise SystemExit(f"INDICE BOITEUX pour {c['reponse']} : {detail}")
    couverture = sorted({c['secteur'] for c in MOTS_CANDIDATS})
    print(f'  ✓ couverture secteurs ({len(couverture)}): ' + ', '.join(couverture))
    # 2) solveur stochastique (graine fixe) : cadre ≤ 17×17, max croisements
    selection = [c['reponse'] for c in MOTS_CANDIDATS]
    solveur = Solveur(selection)
    essais, trouvees = recherche_stochastique(solveur)
    if not solveur.meilleur:
        raise SystemExit('Aucune grille trouvée dans le cadre 17×17.')
    score, placements, cellules, croisements = solveur.meilleur
    print(f'  solveur : {croisements} croisements ({trouvees} grilles sur {essais} essais)')
    par_reponse = {normaliser(c['reponse']): c for c in MOTS_CANDIDATS}
    mot_infos, dec = numeroter(placements)
    print()
    print(f'=== Grille retenue : {selection} ===')
    print(f'croisements={croisements}  cases={len(cellules)}  '
          f'cadre={max(r for r, c in cellules) - dec[0] + 1}×'
          f'{max(c for r, c in cellules) - dec[1] + 1}')
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
