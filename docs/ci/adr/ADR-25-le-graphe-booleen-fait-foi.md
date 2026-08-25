# ADR-25 — Le graphe booléen fait foi, la géométrie est un cache

**Statut** : accepté, 25 août 2026.
**Contexte** : invariants 3, 4 et 6 de `CLAUDE.md` ; § Formats de fichiers.

## Le problème

Le studio doit pouvoir creuser une forme dans une autre — le geste que Roblox Studio appelle
*Negate* puis *Union*, et que toute la modélisation 3D appelle **CSG** (*Constructive Solid
Geometry*). Un mur, un cube posé dedans, et il en sort une fenêtre.

La demande n'est pas la fonctionnalité, elle est la **tenue en charge** : ce studio est un
**éditeur**, pas une scène finie. Le nombre d'objets n'est pas connu à l'écriture — il est décidé
par la personne qui travaille, et il n'a pas de plafond. Et le moteur devra plus tard servir hors du
studio, pour faire tourner des jeux.

Trois façons de rater ça, toutes vertes au typecheck :

1. **Écrire le maillage comme document.** L'édition devient destructive, le *Separate* impossible,
   et la géométrie ne peut plus être jetée puisqu'elle est la seule copie.
2. **Évaluer pendant le geste.** Tient sur trois cubes, s'effondre sur un vrai projet, et rien ne
   prévient — la chute est progressive.
3. **Remettre les collisions à plus tard.** Un mur percé a un collider *concave* ; s'en apercevoir
   après coup oblige à changer le format des documents déjà écrits.

## La décision

> Le **graphe** — brushes, opérations, transforms — est le document.
> La **géométrie évaluée** est un cache : dérivée, jetable, reconstructible.
> Rien n'est évalué pendant un geste ; tout est évalué **au relâchement**, hors du thread UI.

## Ce qui en découle

`[M]` **Le moteur ignore le studio.** `engines/csg/` ne contient aucun import React, comme le veut
l'invariant 4, et ne connaît ni document, ni onglet, ni sélection. C'est cette couche, et elle
seule, qui sera réutilisée pour faire tourner un jeu — où l'évaluation n'a **pas** lieu à
l'exécution : elle a lieu à l'édition, et le runtime ne charge que des géométries figées.

`[M]` **L'évaluation suit `bvh.worker.ts`, avec une différence assumée.** Le dépôt tient déjà ce
motif dans `engines/scene/` : le calcul part en Worker et **le retour traverse en `ArrayBuffer`
transférables**, jamais en objet three.js — une `BufferGeometry` n'est pas clonable par structure, et
le Worker n'a de toute façon aucune scène où la poser. La différence est à l'**aller** : c'est le
GRAPHE qui part, quelques centaines d'octets, parce qu'un brush est un descripteur et que le Worker
sait en refaire la géométrie. Le Worker BVH, lui, doit recevoir des buffers : son entrée vient d'un
GLB quelconque et rien de ce côté ne sait la décrire.

`[M]` **Rien de tout cela ne se réécrit.** `createWorkerSession` (`engines/core/`) tient déjà le
worker de session, la numérotation des messages et le rejet en cas de mort du thread ;
`createRefCache` tient déjà le comptage de références et la course du « relâché pendant le vol ».
Les deux sont réutilisés tels quels.

`[M]` **Le cache est indexé par une clé canonique du graphe, et non par un hash numérique.** Deux
objets dont le graphe est identique partagent **une** géométrie — dans un éditeur, le copier-coller
est le geste nominal, et deux cents fenêtres identiques sont un lundi matin ordinaire. C'est cette
clé qui rend l'instanciation possible ; sans elle, chaque union est un objet unique. **Une chaîne
plutôt qu'un entier** parce qu'un hash 32 bits collide à mieux que pile ou face passé quelque 77 000
entrées, et qu'une collision ici n'échoue pas : elle dessine le MAUVAIS solide, toutes gardes vertes.
La clé lit la forme et la pose de chaque brush, **jamais le nom ni la fidélité de collision** — les
renommer laisse le maillage identique, donc partagé.

`[M]` **La libération est explicite, parce que three.js ne libère rien.** `geometry.dispose()` et
`material.dispose()` sont manuels, et une géométrie issue d'un booléen vit **deux fois** — les
buffers en VRAM, l'arbre BVH en RAM. Le cache est **compté par références**, non évincé sur un
budget : `engines/core/refCache.ts` existait déjà et libère un solide dès que plus aucun nœud ne le
désigne. C'est plus étroit qu'un LRU, sans seuil à régler, et incapable de garder une géométrie que
personne ne dessine. Jeter est sans risque, puisque le graphe reconstruit.

`[M]` **Ce qui n'est pas encore évalué s'affiche en brushes bruts.** Le mur plein, sans sa fenêtre —
jamais un objet manquant, jamais un trou noir. L'éditeur reste utilisable pendant que le calcul
rattrape.

`[?]` **La file priorisée n'est PAS livrée, et ce paragraphe remplace ce que l'ADR annonçait.** Ce
qui existe est un Worker unique en FIFO : pas de tri *visible → proche → hors champ*, pas
d'annulation, pas de pool borné à `hardwareConcurrency − 2`. L'invariant 6 est tenu sur le point qui
compte — le calcul quitte le thread UI — et pas sur les trois autres. Une découpe longue retarde
donc celles qui suivent. **À reprendre quand une mesure montrera que ça gêne**, pas avant : rien
n'est mesuré à ce jour.

`[M]` **Le graphe conserve les brushes d'origine, et c'est une obligation, pas un confort.** C'est ce
qui permet le *Separate*, et c'est surtout ce qui rend les collisions calculables — voir la section
suivante. Un graphe qui ne garderait que le maillage résultant condamnerait la physique à la
décomposition approchée.

`[M]` **Deux champs sont pris tant qu'ils sont libres, pour la même raison.** La **fidélité de
collision** par solide — `box` / `hull` / `convexes` / `trimesh`, comme le `CollisionFidelity` de
Roblox — qu'aucune physique ne lit encore. Et la **matière de chaque brosse** dans le graphe : sans
elle, souder un cube rouge à une sphère bleue puis séparer rendait les deux dans la couleur du
solide. Les ajouter plus tard voudrait dire migrer tous les documents déjà écrits ; aujourd'hui le
coût est nul.

`[M]` **Un solide ne se découpe pas dans un autre solide, et c'est un refus écrit.** La liste de
pas est plate : plier un solide dedans garderait sa brosse de base et jetterait en silence toutes
les découpes déjà faites. La barre refuse plutôt que de tronquer — il faut le séparer d'abord.

`[M]` **Le graphe voyage en `extras` glTF, verbatim, et les meshes évalués au standard.** C'est le
mécanisme déjà prouvé quatre fois par le § Formats de `CLAUDE.md` : la fenêtre produit la structure
standard, le `content` du document EST cette structure, et ce que le standard ne porte pas va à
l'endroit qu'il réserve aux tiers — **sans transformation**, pour que relire soit une seule passe.
Un lecteur glTF étranger ouvre la scène et voit des murs percés ; le studio, lui, retrouve de quoi
les rouvrir.

## Les collisions, décidées ici plutôt que subies plus tard

`[M]` **On ne décompose jamais le résultat.** Le réflexe de l'industrie — prendre le maillage sorti
du booléen et lui appliquer une décomposition convexe approchée (V-HACD, CoACD) — jette
l'information puis la paye cher pour la reconstruire *à peu près*. Or les brushes de départ sont
**déjà convexes**.

`[M]` **Soustraction convexe par demi-espaces.** Pour `A − B` avec A et B convexes, on découpe A par
chaque plan de B ; le morceau situé du côté extérieur d'un plan est convexe, et en clippant
successivement — morceau *i* = A, hors du plan *i*, mais dans les plans 1…*i−1* — on obtient une
partition **exacte et disjointe** en au plus N convexes, N étant le nombre de faces de B. Un mur
moins un cube donne 6 candidats, dont 4 non vides pour une fenêtre traversante. C'est du clipping de
polyèdre : exact, et sans commune mesure avec une décomposition approchée.

`[M]` **Un plafond de convexes, explicite.** La technique **compose** — si A est déjà une liste de
convexes, on l'applique à chaque morceau — mais elle compose *multiplicativement*. Au-delà d'un
plafond (32 pour commencer), l'objet bascule sur du trimesh. Sans ce garde-fou, une chaîne de
soustractions fabrique un objet à quelques milliers de colliders sans que personne le voie.

`[M]` **Trois niveaux, et le premier est gratuit.** Le décor statique — la grande majorité des
objets — collide contre le **BVH déjà construit pour le picking** : `three-mesh-bvh` expose
`shapecast`, `intersectsBox` et `intersectsSphere`, et le dépôt amont fournit un exemple de
déplacement de personnage contre une géométrie de niveau. Ce qui bouge prend les convexes issus du
graphe. La décomposition approchée n'est gardée que pour un maillage **importé sans graphe**, hors
ligne et en cache.

`[M]` **La broadphase lit l'AABB du graphe, jamais celle du mesh évalué.** Un objet dont la
géométrie a été évincée du cache reste donc collidable sans occuper de VRAM.

## Angles morts, écrits plutôt que cachés

`[?]` **Rien de ce qui précède n'est mesuré sur cette machine.** Les coûts annoncés — microsecondes
pour le clipping, effondrement de l'évaluation en temps réel — sont des ordres de grandeur de
conception, pas des relevés. La première mesure qui compte est le temps d'évaluation d'un booléen
sur un maillage dense, et elle reste à faire.

`[?]` **Instancier et culler tirent en sens opposés.** Fusionner pour baisser les draw calls rend le
frustum culling inopérant sur les objets individuels ; découper pour culler fait remonter les draw
calls. Le parti pris est le culling par **chunk spatial** plutôt que par objet, mais il n'est pas
arbitré par une mesure, et il pourra devoir changer.

`[?]` **L'occlusion culling n'existe pas dans three.js et n'est pas fourni ici.** Un mur devant une
pièce ne cache rien tout seul. C'est un chantier à part entière — partitionnement spatial ou Hi-Z —
et il n'est pas ouvert par cette ADR.

`[?]` **Un export part avec ce que l'écran montre.** `exportObjects` lit les objets du viewport :
tant qu'une découpe n'a pas atterri, le `.glb` ou l'`.usdz` sort avec le mur PLEIN, sans attente ni
avertissement. Afficher la brosse brute est la décision ci-dessus pour l'écran ; ce n'en est pas une
pour un fichier livré, et c'est un trou connu, pas un réglage.

`[?]` **Le nombre de triangles augmente.** La triangulation des faces coupées produit plus de
triangles que les brushes d'origine. « Aucune perte » vaut pour les draw calls, pas pour la
géométrie.

## Ce qui n'est pas décidé ici

**Le moteur physique.** Rien dans `package.json` n'en fournit aujourd'hui. Rapier est le candidat —
il gère nativement le trimesh statique et les compounds de convexes, et il est **déterministe**, ce
qui deviendra indispensable dès qu'un jeu aura du replay ou du réseau. Mais la couche décrite
ci-dessus n'en dépend pas, et le choix se fera quand la physique sera le sujet.

**La décomposition convexe elle-même.** Cette ADR scelle l'algorithme et l'endroit où il vivra ; son
écriture est un lot à part. C'est de la géométrie pure, donc testable sans navigateur ni moteur
physique.
