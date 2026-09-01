# Chantier B — à partir de quelle taille de groupe l'instanciation paie

Mesuré le 2026-09-01, **Apple M2 Max**, Electron 43 / Chromium 150, three 0.185.1, WebGL.
Fenêtre visible 1600×900, `pixelRatio` 1, `backgroundThrottling` désactivé.
16 mesures en page, aucun échec. **Aucune ligne de code de production n'a été modifiée** et
`WORTH_INSTANCING` vaut toujours 64.

## Ce que ce banc mesure, et ce qu'il ne mesure pas

**10 000 corps dans tous les cas.** Seule la taille des groupes change ; le nombre de draw calls
est la seule variable. Le compte de triangles est identique dans chaque paire séparés/instanciés,
ce qui est le contrôle que les deux scènes comparées sont bien la même.

**Un groupe est un couple (géométrie, matériau)**, comme la clé qu'`instancing.ts` compose.
Cinq formes du studio — cube, sphère, cylindre, cône, noeud de tore — et un matériau par groupe
portant sa rugosité, son métal et, un groupe sur deux, une carte.

**Le temps CPU se prend sur un bloc de quinze frames.** `performance.now()` est clampé à 100 µs
dans une page non isolée, et les valeurs cherchées ici passent sous ce tick — c'est le défaut qui
avait rendu inexploitables les colonnes CPU du spike WebGPU.

🛑 **Ces chiffres ne se mélangent avec aucun autre banc.** Ils ne s'additionnent pas à ceux de
`SceneRenderer.apply` : ce sont des scènes différentes, mesurées séparément. Aucun « temps total
de frame » n'est composé ici.

## Le rendu, par taille de groupe

| taille | groupes | CPU séparés | CPU instanciés | gain CPU | GPU sép. | GPU inst. | FPS sép. | FPS inst. | calls sép. | calls inst. |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 4 | 2 500 | 11,38 ms | 4,71 ms | **59 %** | 1,76 | 1,42 | 72,5 | 119,5 | 10 000 | 2 500 |
| 8 | 1 250 | 10,39 ms | 2,02 ms | **81 %** | 1,53 | 1,38 | 77,7 | 127,9 | 10 000 | 1 250 |
| 16 | 625 | 8,62 ms | 0,86 ms | **90 %** | 1,50 | 1,40 | 95,0 | 129,0 | 10 000 | 625 |
| 32 | 313 | 8,37 ms | 0,43 ms | **95 %** | 1,48 | 1,34 | 99,3 | 122,8 | 10 000 | 313 |
| **64** | 157 | 8,15 ms | 0,35 ms | **96 %** | 1,50 | 1,36 | 100,7 | 124,9 | 10 000 | 157 |
| 128 | 79 | 8,31 ms | 0,11 ms | **99 %** | 1,48 | 1,27 | 100,6 | 121,0 | 10 000 | 79 |
| 256 | 40 | 8,38 ms | 0,05 ms | **99 %** | 1,47 | 1,25 | 97,8 | 125,0 | 10 000 | 40 |
| 1 000 | 10 | 8,46 ms | 0,02 ms | **100 %** | 1,48 | 1,25 | 97,3 | 125,1 | 10 000 | 10 |

Trois lectures :

- **Le GPU ne bouge pas** — 1,25 à 1,76 ms partout, instancié ou non. Il n'a jamais été le sujet.
- **Le gain est déjà de 59 % à quatre corps par groupe**, et il fait passer la scène de 72,5 à
  119,5 FPS. À seize, il est de 90 %.
- **Le seuil actuel n'est pas un point d'inflexion.** Entre 32 et 64, le gain passe de 95 % à
  96 % : la courbe est plate bien avant le plancher. L'inflexion, si on veut en nommer une, est
  entre 4 et 16.

## Le regroupement, la moitié que le plancher défend

Le tableau ci-dessus dit ce qu'un rendu déjà groupé économise. Le plancher, lui, existe contre le
prix de `rebuild`, payé à chaque changement de contenu. Mesuré à part, sur le vrai
`createInstancedGroups`, 10 000 noeuds, médiane de 8 passes, trois séries :

| taille | groupes | noeuds groupés | instances | rebuild série 1 | série 2 | série 3 |
|---:|---:|---:|---:|---:|---:|---:|
| 4 | 2 500 | **0** | 0 | 9,4 ms | 14,2 ms | 8,3 ms |
| 8 | 1 250 | **0** | 0 | 12,7 ms | 21,8 ms | 13,2 ms |
| 16 | 625 | **0** | 0 | 23,3 ms | 26,9 ms | 7,6 ms |
| 32 | 313 | **0** | 0 | 8,0 ms | 7,0 ms | 8,0 ms |
| 64 | 157 | 9 984 | 156 | 12,6 ms | 29,0 ms | 31,5 ms |
| 128 | 79 | 9 984 | 78 | 10,6 ms | 14,7 ms | 11,6 ms |
| 256 | 40 | 9 984 | 39 | 8,9 ms | 13,2 ms | 10,7 ms |
| 1 000 | 10 | 10 000 | 10 | 11,2 ms | 24,9 ms | 11,6 ms |

**Ce que ces chiffres disent, et rien de plus** : le coût est de l'ordre de dix à trente
millisecondes, **il est très bruité, et il ne montre aucune tendance liée à la taille des
groupes**. Il est dominé par le parcours des 10 000 noeuds, pas par le nombre de groupes formés.
Lire une courbe là-dedans serait inventer.

**Le fait qui tranche est dans la colonne « noeuds groupés »** : sous le plancher, elle est à
ZÉRO. Le regroupement parcourt les 10 000 noeuds, forme ses groupes, constate qu'aucun n'atteint
64, et n'instancie rien. Le coût est payé, le bénéfice non.

## Réponse à la question posée

**`WORTH_INSTANCING = 64` n'est pas correct, et il est trop haut.** Trois raisons mesurées :

1. **Le rendu est déjà rentable à 4 par groupe** : 59 % de CPU, +47 FPS. À 16 le gain est de 90 %.
   Rien dans la courbe ne justifie d'attendre 64.
2. **Le plancher ne protège d'aucun coût croissant.** Le prix de `rebuild` ne monte pas quand les
   groupes rapetissent — il est plat, dans le bruit. L'hypothèse que le plancher défend n'est pas
   confirmée par la mesure.
3. **Sous le plancher, le coût est payé sans le bénéfice.** Le balayage a lieu, le tri a lieu, et
   zéro noeud est instancié.

**À partir de combien c'est rentable, en une phrase : dès quatre corps par groupe pour le rendu**,
et la question ne se pose plus au-delà de seize, où 90 % du CPU de rendu est déjà repris.

## Ce que ce banc ne dit pas

- **La mémoire.** 2 500 `InstancedMesh` pour des groupes de quatre coûtent plus qu'un mesh simple
  par corps, et rien ici ne l'a pesé.
- **La fréquence des deux coûts.** Le gain de rendu est par frame ; le prix de `rebuild` est payé
  aux changements de contenu. Leur rapport dépend du rythme d'édition, que ce banc ne modélise pas.
- **Le seuil optimal.** Ce banc dit que 64 est trop haut, pas où placer le nouveau plancher. Le
  choix entre 4, 8 et 16 demande la mesure de mémoire ci-dessus.
- **Les scènes du produit.** Dix mille corps répartis en groupes réguliers est une forme de
  laboratoire ; une scène réelle a des groupes de tailles inégales.

Aucune optimisation n'est implémentée, aucun seuil n'est changé.
