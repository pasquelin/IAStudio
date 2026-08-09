# Le prompt de la session en boucle

À coller derrière `/loop` dans une session neuve — avec un intervalle (`/loop 45m …`) ou sans, en
laissant la session se cadencer elle-même. **Il est écrit pour survivre à un contexte plein** : tout
ce dont une itération a besoin se relit sur le disque, jamais dans ce qui a été dit plus haut.

**Le mettre à jour en même temps que `docs/todo.md`** quand un chantier change les règles du jeu.

---

Tu reprends le développement de **Scenario Studio**, dans `/Users/pasquelin/Applications/scenario`.
Tu travailles **en boucle** : chaque tour livre **un** lot, du début à la fusion, et se termine sur
un dépôt propre.

## La règle qui rend la boucle increvable

**Ton état vit sur le disque, jamais dans la conversation.** À chaque tour, tu repars de zéro sans
rien supposer de ce qui a été dit avant — un contexte compacté, une session tuée, un ordinateur
redémarré ne doivent rien te coûter d'autre que deux minutes de relecture.

Trois commandes te rendent l'état complet, dans cet ordre, **à chaque tour, sans exception** :

```bash
cd /Users/pasquelin/Applications/scenario
git log --oneline -15 && git status --short && git worktree list
```

puis `docs/todo.md` — **la seule liste de ce qui reste** — et `CLAUDE.md` — les conventions et les
invariants. `.claude/loop/BACKLOG.md` **n'existe plus** : ne pas l'y chercher, et ne pas conclure
d'un renvoi trouvé ailleurs qu'il est quelque part.

**Si tu ne sais plus où tu en es, c'est que tu n'as pas encore lu ces quatre choses.** Ne demande
pas, ne devine pas, ne recommence pas un chantier : relis.

## Ce qu'est un tour

**Un tour = un lot livrable, fusionné dans `develop`, et `docs/todo.md` à jour.** Pas deux lots,
pas la moitié d'un.

1. **Relire l'état** (ci-dessus). `git worktree list` **avant d'ouvrir quoi que ce soit** :
   plusieurs sessions travaillent en parallèle, ne prends pas un sujet déjà tenu. Un
   « branch already exists » veut dire qu'un autre y travaille — n'y entre pas.
2. **Choisir une entrée** de `docs/todo.md`, en descendant par gravité : § 0 la porte, § 1 ce qui
   perd du travail, § 2 les gestes qui n'aboutissent pas, § 3 ce que l'interface ne dit pas, § 4 à
   § 6 ce qui manque. **Annonce laquelle et pourquoi elle, en deux phrases**, avant de coder.
3. **Ouvrir un worktree** :
   ```bash
   git worktree add .claude/worktrees/<nom> -b feat/<nom> develop
   cp CLAUDE.md .claude/worktrees/<nom>/
   mkdir -p .claude/worktrees/<nom>/secrets && cp secrets/.env .claude/worktrees/<nom>/secrets/
   cd .claude/worktrees/<nom> && pnpm install
   ```
   `docs/specs/`, `docs/scenario-api/` et `docs/superpowers/` sont ignorés par git, donc absents
   d'un worktree neuf. **Ils ne sont pas perdus** — ils vivent dans le dépôt principal.
4. **Écrire le code et ses tests dans le même mouvement.** Pas de « on testera après ».
5. **`pnpm validate` vert** — et **relancé après le DERNIER edit**, jamais l'avant-dernier. C'est
   sorti rouge deux fois sur un test écrit avant un refactor et pas rejoué.
6. **Passe de simplification** — réutilisation, simplification, efficacité, altitude. Un correctif
   qui répare le cas du jour sans empêcher qu'on le redéfasse manque d'altitude : ce dépôt verrouille
   ses règles par des tests (`tokens.test.ts`, `spacing.test.ts`, `coverage-thresholds.test.ts`).
7. **Relecture adverse du diff**, en cherchant à le réfuter. **Casser son propre code pour voir si un
   test rougit** : un test qui n'a jamais échoué ne prouve rien.
8. **Mettre la doc à jour là où le code vient de la rendre fausse** — manuel **fr et en**, et
   `docs/todo.md`. Un `grep` sur les tournures de manque (« ne sait pas », « pas encore », « aucun
   bouton ») trouve en trente secondes ce qu'aucune fusion ne signalera. **Et relis les chapitres que
   ton propre lot vient de rendre faux.**
9. **Rebaser puis fusionner** :
   ```bash
   git fetch origin develop && git rebase --autostash develop && pnpm validate
   cd /Users/pasquelin/Applications/scenario && git merge --no-ff feat/<nom> -m "Fusion de …"
   git worktree remove .claude/worktrees/<nom>
   ```
   C'est le `develop` **local** qui fait foi. `git add` **par chemin explicite**, jamais `-A` :
   l'index est partagé entre les sessions.
10. **Clore le tour** par un compte rendu court : ce qui est livré, ce qui a été mesuré, ce qui a
    été écarté et pourquoi. **Finis par « Prochain tour à HH:MM »**, en heure absolue.

## Quand le contexte se remplit au milieu d'un lot

**Ne jamais laisser un lot en suspens dans ta tête.** Dès que tu sens le contexte se remplir :

1. Commite ce qui existe sur la branche du worktree, même incomplet, avec un message qui dit où tu
   en es et ce qui reste.
2. Écris dans `docs/todo.md`, sous l'entrée traitée, **ce que le tour suivant ne doit pas
   redécouvrir** — une mesure faite, une piste écartée, un fichier identifié.
3. Termine le tour proprement. Le tour suivant relira le worktree, le `git log` de sa branche et
   `docs/todo.md`, et reprendra là. **C'est pour ça que l'état va sur le disque.**

Un lot abandonné sans ces trois gestes est du travail à refaire, et c'est la seule façon de perdre
vraiment quelque chose dans cette boucle.

## Ce que `docs/todo.md` est, et ce qu'il n'est pas

**Une liste de ce qui reste, pas un journal.** N'y écris que ce qui coûterait une seconde fois — y
compris **une mesure qui n'a rien donné**, pour qu'elle ne soit pas retentée. Le récit d'une
correction appartient au message de son commit, jamais au fichier.

Chaque entrée commence par **le geste attendu** : ce que l'utilisateur doit pouvoir faire à l'écran.
Pas le mécanisme, pas la cause, pas le remède. Les numéros d'entrée **ne se renumérotent jamais** —
des commits les citent.

## Ce que tu ne tranches pas seul

- **Une entrée qui dit « à trancher » se demande**, elle ne se déduit pas — sauf quand son propre
  « geste attendu » a déjà répondu, et il faut alors le montrer.
- **Aucune dépendance nouvelle sans accord.** Les tests e2e (Playwright) sont **reportés à la fin du
  projet**, c'est décidé.
- **Aucun geste destructeur pris seul** : vider un dossier d'export, réécrire un fichier de
  l'utilisateur, taguer, publier.
- **Ne jamais taguer `develop` ni fusionner une feature dans `main`.** `develop` intègre, `main`
  publie, et la publication appartient à l'humain.

**Quand une question bloque, pose-la et prends autre chose en attendant** — la boucle ne s'arrête pas
sur une question ouverte, elle la met de côté et avance sur un autre front.

## Ce qui se vérifie plutôt que se croire

- **Un chiffre rapporté n'est pas un chiffre mesuré.** Un budget de couverture annoncé dépassé sans
  l'avoir été a coûté deux jours de doute. **Et un chiffre mesuré une fois n'est pas un chiffre
  qu'on peut rejouer** : une mesure qui justifie un choix devient un `*.bench.ts` (`pnpm bench`, la
  convention existe et quatre bancs sont commités), et le commentaire renvoie au banc au lieu
  d'annoncer le nombre. Un commentaire qui cite un chiffre invérifiable est le défaut que ce dépôt
  a déjà payé.
- **Le harnais de mutation ment, et il a trouvé une troisième façon.** Les deux connues : `zsh` ne
  découpe pas une variable en mots — un tableau `TESTS=(a b)` et `"${TESTS[@]}"` — et une mutation
  qui fait déborder la pile ne dit pas « failed », elle tue le fichier, d'où la comparaison des
  **comptes** de tests. La troisième, payée le 10 août : **`git checkout --` ne restaure pas un
  fichier non suivi**, donc sur un lot dont les fichiers sont neufs, git répond « pathspec did not
  match » et les mutations **s'empilent** les unes sur les autres. Restaurer depuis une **copie de
  référence**, et vérifier l'application par `cmp`, jamais par `git diff`.
- **Un rouge ne se croit pas sur parole** : relance une fois avant d'ouvrir une enquête, et ne conclus
  à une régression que si le second passage rougit **au même endroit**. Des échecs qui se déplacent
  d'une exécution à l'autre sont de la contention entre sessions, pas une régression.
- **La doc dit la forme ; seul un appel dit la donnée.** Avant d'écrire du code qui dépend de ce que
  l'API Scenario répond, fais l'appel — la documentation s'est déjà trompée deux fois, en décrivant
  correctement la structure et en annonçant les mauvaises valeurs. `docs/scenario-api/` (209 pages en
  local) **avant le web**.
- **Un cas qu'aucun appel ne produit se dit franchement** : « livré comme une assurance, pas comme un
  correctif », plutôt que de faire passer une déduction pour une mesure.
- **Ce qui ne se juge qu'à l'écran ne se prouve pas sous vitest** — il n'y a pas de GPU. Le § 9 de
  `docs/todo.md` dit le protocole, et le port de debug 9222 est unique : si une autre session a lancé
  l'application, c'est la sienne que tu pilotes.

## Les deux pièges de langue

- **Tout ce qui vit dans `src/` est en anglais** — identifiants, commentaires, JSDoc, noms de
  fichiers, clés i18n, descriptions de tests. Les seules exceptions sont les bundles français de
  `src/shared/i18n/` et les valeurs de test qui en viennent. Hors de `src/`, tout est en français :
  documentation, messages de commit, échanges.
- **La garde de typographie française mord** sur les bundles i18n : espace insécable avant `; : ! ?`
  et `»`, sans quoi la ligne casse et laisse le signe seul en tête de la suivante.
