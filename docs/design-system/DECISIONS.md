# DECISIONS

Les arbitrages rendus, du plus récent au plus ancien. Une décision ferme son sujet :
tant qu'elle n'est pas rouverte explicitement, l'écart qu'elle couvre ne se re-signale
pas.

Chaque entrée porte ce qui a été écarté et pourquoi — sans quoi la passe suivante
refera le même chemin pour aboutir au même endroit.

---

## 2026-08-10 — la flèche du carrousel et le bouton d'angle d'une vignette

**Décidé** : les deux gardent leur composant, et lisent leur peau commune dans
`SHELF_OVERLAY` (`design/styles.ts`). Deux tests, un par site, vérifient qu'ils la
lisent au lieu de la recopier.

**Écarté** : les fusionner en un composant. Ils ont la même signature structurelle
(`button>UiIcon`) et le même contrat (`onClick`), mais divergent sur six points —
gauge (`size-7` / `size-6`), teinte (`text-text` / `text-muted hover:text-text`),
ombre portée, anneau de focus, révélation au focus clavier, et présence dans l'ordre
de tabulation. Les concilier demanderait six props de mode pour dix classes ; le
protocole de fusion l'interdit nommément, et deux fonctions courtes coûtent moins
qu'une indirection. Ce qui devait cesser d'être copié — la révélation au survol de
l'étagère, qui dépend du groupe `group/carousel` déclaré dans `Carousel` et lu depuis
un fichier qui ne l'importe pas — l'est.

**Portée** : `src/renderer/src/design/Carousel.tsx`,
`src/renderer/src/home/sections/Favorites.tsx`, `src/renderer/src/design/styles.ts`.

**Rouvrable si** : un troisième site porte la même peau, ou si les six divergences
tombent à deux — à ce moment le composant unique redevient moins cher que la copie.

---

## 2026-08-10 — les hexadécimaux hors composants

**Décidé** : les 33 valeurs hexadécimales relevées hors `.tsx` ne sont pas des
violations et ne se re-signalent pas. Ce sont trois familles : les couleurs par défaut
d'une lumière ou d'une texture (donnée de document, pas jeton d'interface), le dessin
des curseurs SVG (blanc cerné de noir, lisible sur les deux fonds), et les replis d'un
jeton illisible — chacun documenté sur place, et `theme.test.ts` épingle déjà le seul
couple qui double une valeur d'`index.css`.

**Écarté** : les faire lire les jetons. Un moteur de canvas peint avant qu'une feuille
de style existe, et le processus principal peint la fenêtre avant qu'aucune ne soit
analysée : le repli est ce qui reste quand il n'y a rien à lire.

**Portée** : `src/renderer/src/engines/`, `src/renderer/src/spaces/image/image-tools.ts`,
`src/shared/constants.ts`, `src/shared/domain/`.

Le seul relevé qui tombe dans un `.tsx` — `ColorField.tsx:26` — est un `#ff0000` cité dans
un commentaire qui explique pourquoi la pastille porte son propre nom accessible. Le
catalogue le range déjà parmi ses faux positifs connus ; il ne se re-signale pas.

**Rouvrable si** : un `.tsx` se met à porter un hexadécimal **ailleurs que dans un
commentaire**, ou si un repli cesse d'être accompagné de la raison qui le justifie.
