#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GÉNÉRATEUR DE LA GRILLE DE MOTS CROISÉS — Palier 2 « Escale Labège ».

Entrée  : CANDIDATS ci-dessous (réponses + définitions à jeux de lettres).
Sortie  : le tableau JS `var MOTS = [...]` prêt à coller dans 1721310619.html,
          avec (num, dir, row, col) calculés et la grille rendue en ASCII.

Règles de construction (mots croisés classiques) :
  - chaque mot croise AU MOINS un autre mot (grille entièrement connexe) ;
  - tout croisement est vérifié LETTRE PAR LETTRE (la case partagée porte la
    même lettre pour les deux mots) ;
  - aucune touche illégale : hors croisement, deux cases de mots différents
    ne sont jamais voisines orthogonales ; un blanc encadre chaque extrémité.
  - objectif de recherche : maximiser les croisements, minimiser le cadre.

Chaque définition cite ses lettres « entre guillemets » : le script VÉRIFIE
(multiset de lettres) que les fragments cités reforment exactement la
réponse — c'est le verrou anti-IA (les LLM comptent mal les lettres).

Usage : PYTHONUTF8=1 python3 tools/generer_mots_croises.py
"""
import unicodedata
from itertools import combinations

# ---------------------------------------------------------------
# Réponses candidates « Fnac Labège » — jargon vendeur + territoire.
# Chaque définition est une charade/anagramme entre « guillemets »
# (lettres exactes reconstituant la réponse) + une accroche locale.
# ---------------------------------------------------------------
CANDIDATS = {
    'MONTAUDRAN': "« MONTANA » endurci de « DUR » : la piste des géants toute proche, d'où décollaient Mermoz et Saint-Exupéry.",
    'ADHERENT':   "« ANTHÈRE » coiffée d'un « D » : il renouvelle sa carte chaque année pour cumuler les avantages.",
    'OCCASION':   "« CAS », « COIN » puis « O » : le rayon où chaque article a déjà vécu une première vie.",
    'INNOPOLE':   "« IN » devant « NO » puis « PÔLE » : la technopole de Labège, voisine high-tech du magasin.",
    'GONDOLE':    "« LONGÉ » suivi de « DO » : le meuble promo planté en bout d'allée, centre névralgique des opérations.",
    'VINYLES':    "« VIN », « Y » et « LES » réunis : ils tournent encore à 33 tours au rayon Musique.",
    'LABEGE':     "« BELGE » suivi d'un « A » : la commune qui accueille le magasin, aux portes de Toulouse.",
    'FACING':     "« FAC » suivie d'« ING » : le rituel de l'ouverture, aligner chaque produit face au client.",
    'PASTEL':     "« PLATS » allongés d'un « E » : l'or bleu du Lauragais qui fit la richesse de la région.",
}
# Les 3 ancres « Labège » imposées dans toute grille retenue :
ANCRES = {'MONTAUDRAN', 'LABEGE', 'INNOPOLE'}
NB_MOTS = 8
CIBLE_CROISEMENTS = 9

def normaliser(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn').upper()

def extraire_fragments(definition):
    """Fragments « entre guillemets » de la définition, normalisés."""
    import re
    return [normaliser(m) for m in re.findall("«\\s*([^»]+?)\\s*»", definition)]

def verifier_jeu_de_lettres(mot, definition):
    from collections import Counter
    sol = normaliser(mot)
    frags = extraire_fragments(definition)
    if not frags:
        return False, 'aucun fragment « cité »'
    fusion = ''.join(frags).replace(' ', '')
    ok = Counter(fusion) == Counter(sol)
    return ok, (fusion if not ok else '')

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
            return [(0, (mot, 'h', 0, 0)), (0, (mot, 'v', 0, 0))]
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
            self.resoudre(idx + 1, placements, cellules, proprietaires, croisements + nb_crois)
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
    # 1) verrous anti-IA : les fragments cités reforment la réponse
    print('=== Vérification des jeux de lettres (« citations ») ===')
    for mot, defin in CANDIDATS.items():
        ok, detail = verifier_jeu_de_lettres(mot, defin)
        print(f"  {'✓' if ok else '✗'} {mot:<11} fragments={extraire_fragments(defin)}")
        if not ok:
            raise SystemExit(f'JEU DE LETTRES FAUX pour {mot}: {detail}')
    # 2) essai de chaque sous-ensemble à NB_MOTS contenant les ancres
    autres = [m for m in CANDIDATS if m not in ANCRES]
    meilleur_global = None
    for sous in combinations(autres, NB_MOTS - len(ANCRES)):
        selection = sorted(ANCRES | set(sous))
        solveur = Solveur(selection)
        solveur.resoudre(0, [], {}, {}, 0)
        if solveur.meilleur:
            sc, pl, _, cr = solveur.meilleur
            print(f'  sous-ensemble {sorted(set(selection) - ANCRES)} : {cr} croisements, score {sc}, {solveur.noeuds} nœuds')
        if solveur.meilleur and (meilleur_global is None
                                 or solveur.meilleur[0] > meilleur_global[0][0]):
            meilleur_global = (solveur.meilleur, selection, solveur.noeuds)
    if not meilleur_global:
        raise SystemExit('Aucune grille trouvée.')
    (score, placements, cellules, croisements), selection, noeuds = meilleur_global
    mot_infos, dec = numeroter(placements)
    print()
    print(f'=== Grille retenue : {selection} ===')
    print(f'croisements={croisements}  cases={len(cellules)}  '
          f'cadre={max(r for r, c in cellules) - dec[0] + 1}×'
          f'{max(c for r, c in cellules) - dec[1] + 1}  nœuds={noeuds}')
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
        defin = CANDIDATS[m['reponse']]
        lignes_js.append(
            "    { num: %d, dir: '%s', row: %d, col: %d, reponse: '%s', definition: \"%s\" }"
            % (m['num'], m['dir'], m['row'], m['col'], m['reponse'], defin.replace('"', '\\"')))
    print(',\n'.join(lignes_js))
    print('  ];')

if __name__ == '__main__':
    main()
