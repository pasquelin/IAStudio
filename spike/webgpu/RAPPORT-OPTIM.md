# Chantier A — rendre `apply` proportionnel à ce qui a changé

Mesuré le 2026-09-01 sur MacBook **Apple M2 Max**, vitest sous jsdom, three 0.185.1.
Renderer jamais monté : `redraw` n'a aucun contexte à peindre, donc ce qui est chronométré est
exactement la passe sur l'état. Médiane sur 12 passes, 4 pour la colonne « tous bougent ».

Quatre commits sur `feat/apply-dirty`, un par étape, chiffres avant/après dans chaque message.
`pnpm validate` vert. Aucune ligne de `postfx/` ni de `gpu/` touchée ; le spike WebGPU est intact.

## Comment lire ces chiffres

- `performance.now()` sous Node n'est **pas** clampé — vérifié : 0 valeur sur 36 tombe sur la
  grille des 0,1 ms. C'est l'inverse du banc en page du spike WebGPU, où 404 valeurs sur 414 y
  tombent : ses colonnes CPU étaient quantifiées au tick de 100 µs, ce qui n'invalide pas ses
  écarts de 2,5× à 7× mais rend ses comparaisons sub-0,1 ms sans valeur.
- Trois formes de scène, parce qu'une seule ne mesurait pas ce que ce chantier touche : `plate`
  (aucun parent, aucune lumière), `arbre` (chaque noeud pend du précédent), `ombres` (trois lampes
  dont deux projettent). **La forme éclairée commande** — une scène du produit a des lumières.
- La colonne qui compte est `un seul noeud bougé` : celle de `studioRender`, payée à chaque frame
  d'une partie en cours.

## Résultat

| forme | noeuds | rien ne change | 1 noeud bougé | tous bougent | 1er apply |
|---|---:|---:|---:|---:|---:|
| plate | 1 000 | 0,11 ← 0,20 (−46 %) | 0,14 ← 0,23 (−40 %) | 0,70 ← 0,72 | 23,4 ← 22,5 |
| plate | 10 000 | 0,51 ← 1,20 (−57 %) | 0,59 ← 1,48 (−60 %) | 9,56 ← 9,48 | 130 ← 125 |
| plate | 50 000 | 2,49 ← 8,76 (−72 %) | 3,62 ← 10,00 (−64 %) | 71,6 ← 77,7 (−8 %) | 639 ← 632 |
| arbre | 1 000 | 0,07 ← 0,16 (−57 %) | 0,06 ← 0,17 (−63 %) | 0,48 ← 0,57 (−16 %) | 11,0 ← 10,8 |
| arbre | 10 000 | 0,44 ← 1,39 (−68 %) | 0,61 ← 1,72 (−64 %) | 5,77 ← 8,43 (−32 %) | 119 ← 118 |
| arbre | 50 000 | 1,88 ← 10,98 (−83 %) | 3,28 ← 12,59 (−74 %) | 68,6 ← 79,6 (−14 %) | 2 722 ← 2 498 (+9 %) |
| ombres | 1 000 | 0,09 ← 0,18 (−52 %) | 0,16 ← 0,57 (−72 %) | 6,38 ← 6,16 | 21,1 ← 21,4 |
| ombres | 10 000 | 0,53 ← 1,34 (−60 %) | **0,84 ← 5,81 (−86 %)** | 58,9 ← 61,8 | 120 ← 119 |
| ombres | 50 000 | 2,35 ← 11,08 (−79 %) | **3,77 ← 36,26 (−90 %)** | 326 ← 333 | 626 ← 615 |

## Ce que chaque étape a rendu, sur la colonne qu'elle visait

| étape | ce qu'elle change | gain sur sa cible |
|---|---|---|
| portée des ombres | la boîte englobante est tenue entre les passes | −61 à −74 % (formes éclairées) |
| passe des parents | `hangFromParent` ne se marche que si le contenu a bougé | −29 à −41 % à 50 000 |
| identité et vivants | le test remonte dans la boucle ; le `Set` de N chaînes ne se bâtit qu'au besoin | −34 à −62 % du reste |

🛑 **L'étape des parents rend −29 % sur la forme éclairée, sous la barre des 30 %.** Écrit plutôt
qu'arrondi. Aux petites tailles elle tombe entre −9 et −26 %, la passe n'y ayant jamais coûté
grand-chose.

## Le critère d'acceptation n'est pas atteint

Il demandait `rien ne change` et `1 noeud bougé` **sous 0,5 ms à 50 000 noeuds**. Le résultat est
**2,35 et 3,77 ms** sur la forme éclairée — dix fois mieux qu'avant, trois fois au-dessus de la
cible. Ce qui reste, mesuré :

- **Deux parcours de N incompressibles sans changer la signature.** `apply(state)` reçoit un
  tableau complet ; savoir ce qui a changé demande de comparer N identités. À 50 000, cette seule
  boucle vaut environ 1 ms. La faire tomber exige que l'appelant DISE ce qui a changé — une
  seconde entrée sur `SceneRenderer`, donc un changement d'API que ce chantier s'interdisait.
- **Les passes à appel unique restantes** — `poseMarkers`, `showAidsForSelection`,
  `sweepCompositions` — pèsent ensemble 1,5 ms à 50 000 noeuds et parcourent chacune l'état.
- **`allMoved` reste à 326 ms sur la forme éclairée** : quand tout bouge, il n'y a pas de travail
  à éviter. Ce cas n'arrive pas dans le produit.

Les deux colonnes qui ne devaient pas empirer ne l'ont pas fait : `tous bougent` va de −32 % à
+4 %, le premier `apply` de −1 % à +9 %. Le +9 % de `arbre@50000` est le seul point hors du bruit
du banc, et il porte sur une passe qui coûte 2,7 s — un cas de chargement, pas de frame.

## Ce qui garde ces changements

- `applyEquivalence.test.ts` compare le graphe three.js d'une scène éditée pas à pas à celui d'une
  scène bâtie d'emblée dans l'état final : déplacement, reparentage, suppression, et l'annulation
  d'une séquence entière. **Le harnais de mutation confirme qu'il mord** — `hangAll` privé de son
  réarmement laisse le cas du reparentage ROUGE.
- `shadowReach.test.ts` tient les quatre comportements de la boîte tenue, dont son défaut assumé.
- 3 825 tests des moteurs au vert, `pnpm validate` vert.

## Le prix, écrit plutôt que découvert

Un objet éloigné puis ramené **garde le frustum d'ombre élargi** jusqu'au prochain changement de
contenu. Le sens de l'arrondi est choisi : un frustum trop LARGE perd un peu de résolution, un
frustum trop ÉTROIT coupe l'ombre.

Le gain suppose que les noeuds immobiles gardent leur IDENTITÉ d'une passe à l'autre — ce que
`studioRender` fait. `keepsItsGroup` compare le descripteur de géométrie par référence, donc un
noeud reconstruit à neuf compte comme du contenu et rouvre les passes complètes. C'est correct,
et c'est mesuré dans les deux sens.

## Chantier B — audit de `regroupInstances`, sans rien implémenter

`rebuild` répond combien de noeuds une instance dessine. Les appels de dessin sont les noeuds non
groupés, plus une instance par groupe.

| forme | noeuds | groupés | instances | dessins avant → après |
|---|---:|---:|---:|---:|
| plate | 50 000 | 50 000 | 1 | 50 000 → **1** |
| arbre | 50 000 | 50 000 | 1 | 50 000 → **1** |
| ombres | 50 000 | 49 997 | 1 | 50 000 → **4** |
| variée | 10 000 | 10 000 | 24 | 10 000 → **24** |
| variée | **1 000** | **0** | **0** | 1 000 → **1 000** |

**Ce n'est pas zéro, et le regroupement fonctionne** : sur des corps identiques il ramène 50 000
appels à un seul. La question du prompt — « si c'est zéro, explique pourquoi » — a donc une
réponse, mais elle porte sur une autre ligne.

**La ligne qui compte est `variée@1000` : zéro noeud groupé.** La cause est le plancher,
`WORTH_INSTANCING = 64`, appliqué PAR GROUPE, et la clé d'un groupe est la géométrie ET le
matériau. Mille corps répartis sur 3 formes × 8 matières font 24 groupes de 42 : aucun n'atteint
64, donc aucun n'est instancié. C'est exactement la scène représentative du spike WebGPU — 420
corps, 3 géométries, 8 matériaux — qui y dessinait 936 appels.

**Correctif proposé, non implémenté** : le plancher défend contre un regroupement qui coûterait
plus qu'il ne rend, ce qui est un argument sur le COÛT DU REGROUPEMENT, pas sur le nombre par
groupe. Deux pistes, à mesurer avant de trancher :

1. Abaisser le plancher et le mesurer, plutôt que de le supposer. Le commentaire de `instancing.ts`
   cite 744 fps en un appel, sans dire ce que coûte un groupe de 16.
2. Grouper par GÉOMÉTRIE seule et porter la couleur en attribut d'instance, ce que trois.js sait
   faire (`InstancedMesh.setColorAt`). Les 24 groupes deviennent 3, chacun bien au-dessus du
   plancher. Ce que cela coûte : les matériaux d'un groupe doivent alors ne différer que par ce
   qu'un attribut d'instance porte.

Aucune de ces deux pistes n'est engagée. Le chantier B a son propre banc à écrire — celui-ci
compte des appels de dessin, il ne mesure aucune frame.
