# Accueil — prompt de reprise (lot 2)

À coller tel quel dans une nouvelle session, depuis `/Users/pasquelin/Applications/scenario`.

---

## Contexte

L’accueil du studio existe depuis hier (lot 1, fusionné dans `develop`). C’est un écran plein
cadre — ni rail, ni zone, ni Dockview, la ligne d’état conservée — qui s’ouvre au lancement et
se ferme dès qu’on entre dans un espace.

Ce qui est déjà en place, à réutiliser et non à refaire :

| Quoi | Où |
|---|---|
| Registre des sections, ordre, masquage, limites | `src/shared/domain/home.ts` (+ son test) |
| Garantie « jamais vide » | `visibleHomeSections`, fonction pure testée sur toute la matrice |
| Assemblage de la page, pied « Créer ou explorer » | `src/renderer/src/home/HomeView.tsx` |
| Bande titrée + son menu (monter / descendre / masquer / combien) | `home/Section.tsx`, `home/SectionMenu.tsx` |
| Carte d’étagère (glyphe, nom, sous-titre) | `home/ShelfCard.tsx` |
| Carrousel virtualisé : scroll natif, snap, flèches, pastilles, clavier | `src/renderer/src/design/Carousel.tsx` |
| Six sections livrées | `spotlight`, `tools`, `projects`, `documents`, `jobs`, `activity` |
| Temps relatif (« il y a 2 h ») | `src/renderer/src/helpers/relative-time.ts` |
| Réglages | branche `home` dans `Settings`, `home.enabled` dans Préférences ▸ Général |
| Checklist de validation manuelle | `docs/plans/2026-08-08-accueil-verification.md` |

Le plan des quatre lots : `~/.claude-pro/plans/delegated-doodling-sunrise.md`.

## Ce qu’il faut faire — lot 2, « mon travail »

Quatre sections à ajouter au registre et au `Record<HomeSectionId, FC>` de `home-registry.ts`
(le compilateur exige une entrée par id, c’est le verrou) :

1. **`creations`** — carrousel des derniers assets produits, tous modes confondus. C’est la
   section qui porte le lot : **« Recréer » ne coûte aucun appel réseau**. Le catalogue garde
   déjà `model_id`, `model_label`, `prompt`, `seed` et `gen_params` par asset
   (`src/main/project/catalog.ts`), et `assets:search` trie `created_at DESC` par défaut.
   Recréer = préremplir le générateur du mode concerné avec ces valeurs. Le chemin existe :
   `useModels.prepare(family, modelId, params)` — c’est ce que « regénérer avec ces
   paramètres » utilise déjà depuis l’inspecteur.
2. **`byMode`** — une bande de six compteurs cliquables qui filtrent le mur. Demande une
   requête d’agrégat au catalogue ; elle passe par le worker, pas par le thread principal.
3. **`library`** — la bibliothèque du compte, via `cloud:browse` (existe). Section `requires:
   ['api']`.
4. **`favorites`** — recettes épinglées, **transverses aux projets** : un favori doit survivre
   au changement de projet, donc ni tag de catalogue ni réglage. Un canal `favorites:*`, la
   recette et une vignette sur disque. **Jamais d’URL signée persistée** — elles expirent.

Les tuiles portent le nom du modèle en légende, comme sur scenario.com : `MediaTile` le fait
déjà avec sa prop `caption`.

## Décisions déjà prises — ne pas les rouvrir

- L’accueil **n’est pas un septième `WorkspaceId`**. C’est un booléen de session dans
  `useLayouts`, et `homeIsVisible()` est la seule réponse à « la home est-elle devant ». Le
  shell, la barre de titre et le menu natif la lisent tous les trois.
- **Pas de hero éditorial.** La bannière est bâtie sur l’état réel (reprendre, générations en
  cours, clé manquante, projet vide). Rien qui demanderait à quelqu’un de l’alimenter.
- **Aucune nouvelle charte.** Jetons et composants existants, zéro DaisyUI dans l’accueil.
- Les carrousels **ne nomment jamais leur `behavior` de scroll** : la feuille de style garde le
  dernier mot, et `[data-reduce-motion]` l’emporte. Un test le verrouille.
- Les projets récents vivent dans les réglages, déjà répliqués dans chaque fenêtre — pas de
  canal IPC pour eux.

## Pièges de ce chantier, payés une fois

- **`secrets/.env` est ignoré par git**, donc absent d’un worktree neuf, et son absence ne dit
  pas son nom : l’app démarre en « Non connecté » sans expliquer pourquoi. `cp secrets/.env
  .claude/worktrees/<nom>/secrets/` à la création, comme `CLAUDE.md`.
- **`develop` bouge plusieurs fois par session.** Rebaser après chaque étape, pas à la fin. Un
  rebase propre côté texte peut laisser deux vérités qui se contredisent : la dernière fois,
  `develop` avait résolu le même problème que moi et mieux, et il a fallu jeter ma version.
- **Pas de plomberie spéculative.** Une prop sans appelant en production se fait retirer, même
  testée, même prévue pour le lot suivant. C’est la doctrine du dépôt (« une branche que rien
  n’atteint est une branche que rien ne teste »).
- **Un commentaire qui ment est un défaut.** Vérifier chaque affirmation ajoutée contre le code
  écrit à côté.
- `useDocuments` distingue `documents` (onglets ouverts) et `stored` (ce que le dossier
  contient). Sur un accueil, c’est presque toujours `stored` qu’on veut : au lancement, aucun
  onglet n’est ouvert.

## Definition of done

Dans l’ordre, non négociable : tests colocalisés écrits dans le même mouvement →
`pnpm validate` vert → `/simplify` → `/code-review` → fusion `--no-ff` dans `develop`.

Worktree : `git worktree add .claude/worktrees/home-creations -b feat/home-creations develop`,
puis `cp CLAUDE.md secrets/.env` dedans et `pnpm install`.

## Après le lot 2

**Lot 3 — Explore et Apps.** Le gros bloc de la maquette de référence : masonry infinie avec
onglets par type, pagination au scroll, plus les apps (`workflows.list` → `retrieve` → `run`,
via `DynamicForm` et le `JobManager` — `feat/workflows` est déjà sur `develop`). La masonry
doit suivre le scroll de `HomeView`, pas ouvrir le sien : c’est pour ça que cette page possède
le seul scroll de l’écran.

**Trois mesures à faire contre l’API réelle avant d’écrire le lot 3**, via le MCP `scenario` :
`sortBy` accepte-t-il `score:desc` (défaut sûr `createdAt:desc`) ; comment isoler textures et
skyboxes dans le feed public (sinon masquer ces deux onglets) ; la forme de
`UsageListResponse`.

**Lot 4 — la créativité.** `similar` (`assetSearch({ images: { like } })`, jamais utilisé dans
le studio), `spark` (`generate.prompt`, 0 unité créative), `usage`.

## Une dette connue, à traiter dans son propre lot

« Reprendre où vous en étiez » ne peut pas être exact : un `DocumentDescriptor` ne porte aucune
date. La bannière s’appuie aujourd’hui sur l’onglet actif — honnête, mais muette au lancement,
et la bande des documents est ordonnée par nom faute de mieux. Un `lastActiveAt` estampillé par
`useDocuments.activate` réglerait les deux, et la barre d’onglets le voudra de toute façon.
