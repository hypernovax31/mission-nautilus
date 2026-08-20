#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generer_cluedo.py — Générateur + VALIDATEUR de l'épreuve « CLUEDO DES ABYSSES »
du Palier 3 (Mission Nautilus).

Rôle
----
  1. Définir les 3 catégories (PRODUIT / RAYON / EMPLACEMENT) et le SECRET :
     la destination du QR du palier SUIVANT, fixée par l'admin.
  2. Générer le jeu d'indices :
       • des CARTES « hors de cause » (éliminations directes, façon Cluedo) ;
       • des TÉMOIGNAGES logiques « exactement k affirmations vraies parmi n »
         (le cœur « très complexe » de la déduction) ;
       • une RÉSERVE de cartes supplémentaires, révélées en cours de partie
         (sonar / erreurs) comme mécanique de rattrapage.
  3. VALIDER par recherche exhaustive sur les 216 combinaisons que l'ensemble
     des indices ne laisse qu'UNE SEULE solution (le secret) — jamais de
     contradiction, jamais de solution alternative.

Le script est REJOUABLE : modifiez SECRET (destination), relancez, puis collez
le JSON produit dans 1831411720.html (const CLUEDO = { ... }).

Utilisation :
  python3 tools/generer_cluedo.py
  → affiche la configuration ET l'écrit dans tools/cluedo-palier3-config.json
"""
import json
import random
import itertools
import os

# ---------------------------------------------------------------- données
PRODUITS = [
    ("LIVRE",   "📕 Livre"),
    ("DVD",     "💿 DVD"),
    ("MANETTE", "🎮 Manette"),
    ("VINYLE",  "🎵 Vinyle"),
    ("CASQUE",  "🎧 Casque"),
    ("SOURIS",  "🖱 Souris"),
]
RAYONS = [
    ("LIVRES",       "📚 Rayon Livres"),
    ("INFORMATIQUE", "💻 Rayon Informatique"),
    ("JEUX",         "🎮 Rayon Jeux"),
    ("SON",          "🎧 Rayon Son"),
    ("CINEMA",       "🎬 Rayon Cinéma"),
    ("MUSIQUE",      "🎵 Rayon Musique"),
]
EMPLACEMENTS = [
    ("TETE",       "Tête de gondole"),
    ("BAS",        "Rayonnage bas"),
    ("PRESENTOIR", "Présentoir"),
    ("VITRINE",    "Vitrine"),
    ("RESERVE",    "Réserve"),
    ("CAISSE",     "Caisse"),
]

# ============================== ADMIN — À MODIFIER ========================
# Destination du QR du PALIER SUIVANT (Palier 4). Les trois valeurs DOIVENT
# exister dans les listes ci-dessus.
SECRET = {"produit": "CASQUE", "rayon": "SON", "emplacement": "TETE"}

SEED = 20260821             # graine : génération reproductible
N_VISIBLES = 6              # cartes « hors de cause » montrées d'entrée
PLANCHER_SURVIVANTS = 8     # au moins autant de combinaisons après les cartes
N_TEM_MAX = 9               # témoignages max avant le filet de secours
# ========================================================================

P = [x[0] for x in PRODUITS]
R = [x[0] for x in RAYONS]
E = [x[0] for x in EMPLACEMENTS]
LABELS = {}
LABELS.update(dict(PRODUITS))
LABELS.update(dict(RAYONS))
LABELS.update(dict(EMPLACEMENTS))

SP, SR, SE = SECRET["produit"], SECRET["rayon"], SECRET["emplacement"]


def atom(t, **kw):
    d = {"t": t}
    d.update(kw)
    return d


def eval_atom(a, c):
    p, r, e = c
    t = a["t"]
    if t == "prod_is":
        return p == a["x"]
    if t == "prod_not":
        return p != a["x"]
    if t == "rayon_is":
        return r == a["x"]
    if t == "rayon_not":
        return r != a["x"]
    if t == "empl_is":
        return e == a["x"]
    if t == "empl_not":
        return e != a["x"]
    if t == "pair_is":
        return (p == a["x"]) and (r == a["r"])
    if t == "pair_not":
        return not ((p == a["x"]) and (r == a["r"]))
    raise ValueError("type d'atome inconnu : %s" % t)


def label_atom(a):
    """Humanise un atome (pour le rapport console uniquement — le JS a sa
    propre version)."""
    t = a["t"]
    if t == "prod_is":
        return "le produit est « %s »" % LABELS[a["x"]]
    if t == "prod_not":
        return "le produit n'est PAS « %s »" % LABELS[a["x"]]
    if t == "rayon_is":
        return "le QR est au rayon « %s »" % LABELS[a["x"]]
    if t == "rayon_not":
        return "le QR n'est PAS au rayon « %s »" % LABELS[a["x"]]
    if t == "empl_is":
        return "l'emplacement est « %s »" % LABELS[a["x"]]
    if t == "empl_not":
        return "l'emplacement n'est PAS « %s »" % LABELS[a["x"]]
    if t == "pair_is":
        return "« %s » est au rayon « %s »" % (LABELS[a["x"]], LABELS[a["r"]])
    if t == "pair_not":
        return "« %s » n'est PAS au rayon « %s »" % (LABELS[a["x"]], LABELS[a["r"]])
    return str(a)


def combos():
    return list(itertools.product(P, R, E))


def filtre_cartes(combos, cartes):
    return [c for c in combos if all(eval_atom(a, c) for a in cartes)]


def filtre_tem(combos, tems):
    for t in tems:
        combos = [c for c in combos
                  if sum(1 for a in t["atoms"] if eval_atom(a, c)) == t["k"]]
    return combos


def meme_atome(a, b):
    return json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


def construire():
    rng = random.Random(SEED)

    # ----- cartes « hors de cause » (toutes VRAIES sous le secret) -----
    mild = []
    for x in P:
        if x != SP:
            mild.append(atom("prod_not", x=x))
    for x in R:
        if x != SR:
            mild.append(atom("rayon_not", x=x))
    for x in E:
        if x != SE:
            mild.append(atom("empl_not", x=x))
    for x in P:
        for r in R:
            if not (x == SP and r == SR):
                mild.append(atom("pair_not", x=x, r=r))

    rng.shuffle(mild)

    visible = []
    survivants = combos()
    for a in mild:
        if len(visible) >= N_VISIBLES:
            break
        apres = filtre_cartes(survivants, [a])
        if len(apres) < len(survivants) and len(apres) >= PLANCHER_SURVIVANTS:
            visible.append(a)
            survivants = apres

    reserve = [m for m in mild if not any(meme_atome(m, v) for v in visible)]
    rng.shuffle(reserve)
    # La partie ne révèle qu'au plus 3 sondages + 3 erreurs = 6 cartes : on
    # borne la réserve (16 douces puis 4 fortes) pour garder la page légère.
    reserve = reserve[:16]
    # Les cartes « fortes » (qui révèlent un élément du secret) arrivent en
    # dernier dans la réserve : c'est le dernier recours d'un équipage bloqué.
    reserve += [
        atom("pair_is", x=SP, r=SR),
        atom("empl_is", x=SE),
        atom("rayon_is", x=SR),
        atom("prod_is", x=SP),
    ]

    # ----- témoignages « exactement k parmi n vraies » -----
    def random_atom():
        t = rng.choice([
            "prod_is", "prod_not", "rayon_is", "rayon_not",
            "empl_is", "empl_not", "pair_is", "pair_not",
        ])
        if t.startswith("prod"):
            return atom(t, x=rng.choice(P))
        if t.startswith("rayon"):
            return atom(t, x=rng.choice(R))
        if t.startswith("empl"):
            return atom(t, x=rng.choice(E))
        return atom(t, x=rng.choice(P), r=rng.choice(R))

    tems = []
    survivants_t = survivants[:]
    tentatives = 0
    while len(survivants_t) > 1 and len(tems) < N_TEM_MAX and tentatives < 600:
        tentatives += 1
        n = rng.choice([3, 4])
        atomes = []
        vus = set()
        for _ in range(n):
            a = random_atom()
            cle = json.dumps(a, sort_keys=True)
            if cle in vus:
                continue
            vus.add(cle)
            atomes.append(a)
        if len(atomes) < 2:
            continue
        k = sum(1 for a in atomes if eval_atom(a, (SP, SR, SE)))
        tem = {"k": k, "atoms": atomes}
        apres = filtre_tem(survivants_t, [tem])
        if len(apres) < len(survivants_t) and len(apres) >= 1:
            tems.append(tem)
            survivants_t = apres

    # ----- filet de secours : éliminations complémentaires propres -----
    # (réutilise des atomes VRAIS mais jamais encore posés, pour converger
    # sans jamais livrer le secret en clair)
    secours = [
        atom("prod_not", x=x) for x in P if x != SP
    ] + [
        atom("rayon_not", x=x) for x in R if x != SR
    ] + [
        atom("empl_not", x=x) for x in E if x != SE
    ] + [
        atom("pair_not", x=x, r=r) for x in P for r in R
        if not (x == SP and r == SR)
    ]
    rng.shuffle(secours)
    for a in secours:
        if len(survivants_t) <= 1:
            break
        if any(meme_atome(a, v) for v in visible):
            continue
        tem = {"k": 1, "atoms": [a]}
        apres = filtre_tem(survivants_t, [tem])
        if len(apres) < len(survivants_t):
            tems.append(tem)
            survivants_t = apres

    return {
        "visible": visible,
        "reserve": reserve,
        "temoignages": tems,
        "survivants_apres_cartes": len(survivants),
        "survivants_finaux": survivants_t,
    }


def rapport(gen):
    print("=" * 70)
    print("CLUEDO DES ABYSSES — génération de l'épreuve du Palier 3")
    print("=" * 70)
    print("SECRET (destination du QR du palier 4) :")
    print("   PRODUIT     :", LABELS[SP])
    print("   RAYON       :", LABELS[SR])
    print("   EMPLACEMENT :", LABELS[SE])
    print("-" * 70)
    print("Cartes « hors de cause » montrées d'entrée :", len(gen["visible"]))
    for a in gen["visible"]:
        print("   •", label_atom(a))
    print("Survivants après cartes :", gen["survivants_apres_cartes"], "/ 216")
    print("-" * 70)
    print("Témoignages (exactement k parmi n vraies) :", len(gen["temoignages"]))
    surv = gen["survivants_apres_cartes"]
    for i, t in enumerate(gen["temoignages"], 1):
        corps = " ; ".join(label_atom(a) for a in t["atoms"])
        apres = filtre_tem(gen["survivants_finaux"], [])
        print("   %d) exactement %d vraies parmi : %s" % (i, t["k"], corps))
    print("-" * 70)
    print("Réserve (cartes à révéler en cours de partie) :", len(gen["reserve"]))
    print("Survivants FINAUX :", len(gen["survivants_finaux"]), "/ 216")
    if gen["survivants_finaux"] == [(SP, SR, SE)]:
        print("✔ SOLUTION UNIQUE — l'énigme est solvable et sans ambiguïté.")
    else:
        print("✘ ERREUR : solutions restantes =", gen["survivants_finaux"])
    print("=" * 70)


def config_json(gen):
    categories = {
        "produit": {
            "label": "PRODUIT",
            "items": [{"id": i, "label": l} for i, l in PRODUITS],
        },
        "rayon": {
            "label": "RAYON",
            "items": [{"id": i, "label": l} for i, l in RAYONS],
        },
        "emplacement": {
            "label": "EMPLACEMENT",
            "items": [{"id": i, "label": l} for i, l in EMPLACEMENTS],
        },
    }
    return {
        "categories": categories,
        "secret": SECRET,
        "cartes": gen["visible"],
        "reserve": gen["reserve"],
        "temoignages": gen["temoignages"],
    }


def main():
    gen = construire()
    rapport(gen)
    assert gen["survivants_finaux"] == [(SP, SR, SE)], \
        "L'énigme générée n'a PAS une solution unique — ajustez la graine " \
        "ou les réglages, puis relancez."
    cfg = config_json(gen)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "cluedo-palier3-config.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    print("\n✔ Configuration écrite dans :", out)
    print("\nJSON à coller dans 1831411720.html (const CLUEDO = …) :\n")
    print(json.dumps(cfg, ensure_ascii=False))


if __name__ == "__main__":
    main()
