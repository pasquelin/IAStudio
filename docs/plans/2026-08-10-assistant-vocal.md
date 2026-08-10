# Plan — l'assistant vocal

**Branche** `feat/assistant` · **Worktree** `.claude/worktrees/assistant` · **Base** `develop`

Écrit le 10 août 2026, après une séance de conception avec l'utilisateur et **six appels réels à
l'API Scenario**. Tous les chiffres de ce document sont mesurés, jamais déduits — la colonne qui le
dit est en tête de chaque tableau.

---

## Le geste attendu

> J'appuie sur un raccourci, ou je clique un bouton unique dans la barre de l'application. Je parle.
> **Le studio fait ce que j'ai demandé** — il crée le projet, il choisit le modèle, il écrit dans le
> champ que j'ai nommé, il lance la génération. Ce qui coûte ou ne se défait pas me demande d'abord.
> Ce qu'il n'a pas compris, il le dit au lieu de l'inventer.

Ce que ça remplace : un micro accroché sous **chaque** champ de texte long, qui ne sait pas sous quel
champ il est.

---

## Ce que ce chantier règle, et qui est déjà écrit ailleurs

**L'entrée 41 de [`docs/todo.md`](../todo.md) — « La dictée : le geste demandé n'a jamais existé ».**
Elle n'est pas contournée par ce plan, elle est **résolue par construction**, et il faut voir
pourquoi avant de lire le reste :

| Cause de l'entrée 41 | Ce que ce plan en fait |
|---|---|
| Les trois micros d'un formulaire s'allument ensemble, parce que `DictationField` lit un store global et « holds nothing about the field it sits under » | **Il n'y a plus qu'un micro**, dans la coquille. Le problème n'a plus de support |
| Le clic sur le micro donne le focus au bouton ; `insertAtCaret` écrit dans `document.activeElement`, qui n'est plus le champ | **Le champ visé est nommé**, pas deviné : `field.set({ target: "generator.prompt" })`. `document.activeElement` sort du chemin |
| `insertAtCaret` rend `false` et personne ne le lit (`stores/dictation.ts:108`) | Un outil qui échoue **rend son échec à l'assistant**, qui le dit à l'écran |

**Le raccourci `⌥D` fonctionne aujourd'hui, le bouton non** — parce qu'une touche maintenue ne
déplace pas le focus. C'est un détail qui a masqué le défaut : la feature marche pour qui utilise le
raccourci, et pour personne d'autre.

---

## Ce qui est mesuré — 10 août 2026, compte réel

Six appels, dont quatre en `dryRun` (gratuits) et deux réels.

| Opération | Unités créatives | Comment |
|---|---|---|
| Transcrire la voix (Parakeet, local) | **0** | déjà livré ; ne quitte pas la machine |
| Rédiger un prompt (`generate/prompt`, mode `contextual-v2`) | **0** | `dryRun` sur `prompt_spark` → `creativeUnitsCost: 0` |
| **Comprendre une intention** (`model_scenario-llm`, `claude-haiku-4-5`) | **0,75** | `dryRun`, instruction courte |
| Générer une image (`model_google-gemini-3-1-flash`, prompt simple) | **12** | `dryRun` |

**Seize commandes vocales coûtent une image.** Le coût est réel et marginal. Il justifie que
l'assistant soit désactivable, il ne justifie pas d'y renoncer.

### Ce que le routeur a réellement répondu

Un appel réel, `claude-haiku-4-5`, six phrases d'un coup, cinq outils décrits dans l'instruction et
un état courant fictif (`projet = Western, espace = image, modèle = aucun`). Réponse intégrale,
`asset_Yx8i7kuknqQPXkk2Xtreo1Dt` :

| Dit | Rendu | Confiance |
|---|---|---|
| « génère moi une image de cheval au galop en **format paysage** » | `image.generate({prompt:"cheval au galop", aspectRatio:"16:9"})` | 0.95 |
| « crée moi un projet qui s'appelle Far West » | `project.create({name:"Far West"})` | 0.95 |
| « **passe en 3D** » | `workspace.open({id:"three"})` | 0.95 |
| « annule » | `job.cancel({})` | 0.95 |
| « reprends l'image d'avant mais en plus sombre » | **`tool: null`** — « Impossible : pas de génération en cours à modifier » | 0.7 |
| « euh attends, non, laisse tomber, **en fait mets plutôt le modèle flux** » | `model.select({query:"flux"})` | 0.9 |

**Trois comportements à retenir, parce que le design s'appuie dessus :**

1. Il **traduit vers le vocabulaire interne** : « format paysage » → `16:9`, « 3D » → `three` — deux
   valeurs qu'il n'a vues que dans la liste des outils.
2. Il **jette le bruit d'hésitation** de la phrase 6 pour ne garder que l'intention finale.
3. Il **refuse plutôt que d'inventer**, en justifiant depuis l'état courant qu'on lui a donné. C'est
   le comportement qui sépare un assistant utilisable d'un assistant dangereux, et il est spontané —
   rien dans l'instruction ne le demandait explicitement.

Le champ `say` revient en français correct et accentué, affichable tel quel.

> **Six phrases ne sont pas une mesure de fiabilité.** Elles prouvent que le chemin existe et que le
> format tient. Le taux d'erreur sur un vrai vocabulaire est à établir à l'étape 2.

---

## Ce qui rend le chantier petit : le LLM est un modèle comme un autre

`model_scenario-llm` — schéma relevé le 10 août — est un modèle Scenario ordinaire,
`capabilities: ["txt2txt", "img2txt"]`, appelé par **`generate.runModel`**. Le SDK n'a **aucune**
méthode `analyze` : sa classe `Generate` expose `caption`, `describeStyle`, `detect`, `embed`,
`patch`, `prompt`, `runModel`, `translate`. Ne pas en chercher une autre.

| Paramètre | Type | Contrainte |
|---|---|---|
| `instruction` | `string` | **requis**, 10 000 caractères |
| `textInputs` | `string[]` | 10 max — « passer un tableau même pour une valeur » |
| `images` | `file[]` | 10 max, `kind: image` |
| `numOutputs` | `number` | 1–5, défaut 1 |
| `model` | `string` | dix valeurs, défaut `gemini-2.5-flash` |
| `thinkingLevel` | `string` | `gemini-3-flash-preview` seulement, ignoré ailleurs |

**Conséquences, et ce sont elles qui bornent le travail :**

- Il passe par le **`JobManager`** : concurrence bornée, progression, backoff 429. Aucun poll ailleurs.
- Il passe par le **`ModelRegistry`** : ses champs se découvrent, ils ne s'écrivent pas.
- Il passe par **`costEstimatorOf`** (`src/main/scenario/cost.ts:37`), qui lit déjà `creativeUnitsCost`.
- **Le réglage « quel LLM » se construit tout seul** depuis les `allowed_values` du schéma. Écrire les
  dix modèles en dur serait une violation de l'invariant 5 de `CLAUDE.md`.
- Aucun nouveau chemin réseau, aucune clé supplémentaire, aucune dépendance ajoutée.

**Il n'y a pas de `tools` natif.** Le catalogue d'outils voyage dans `instruction`, et la réponse est
du texte qu'il faut valider. `src/main/scenario/validation.ts` fait déjà exactement ce travail avec
zod pour les autres réponses de l'API.

---

## Les décisions tranchées avec l'utilisateur

1. **Le cerveau est Scenario**, pas un LLM local, pas une API tierce. Modèle choisi dans les
   Préférences. Défaut proposé : `claude-haiku-4-5` — le seul testé, et le moins cher de sa famille.
2. **L'assistant est un bonus, pas un dû.** Désactivé, il ne coûte rien et n'appelle rien ; il reste
   la dictée locale et gratuite.
3. **Tout est un outil.** Écrire dans un champ, rédiger un prompt, générer, ouvrir un espace : la
   même mécanique. Il n'y a pas un « mode dictée » et un « mode assistant ».
4. **La confirmation dépend du coût et de la réversibilité**, outil par outil. Pas d'un seuil de
   confiance : un score n'est pas une garantie, et six phrases ne le calibrent pas.
5. **Un seul point d'entrée**, global : un bouton dans la coquille et un raccourci.

### La phrase exacte à écrire dans les réglages

La dictée affiche aujourd'hui : « *Tout se passe sur cet ordinateur : rien de ce que vous dites n'est
envoyé nulle part.* » **Elle cesse d'être vraie dès que l'assistant est actif, et elle doit changer.**

- **La voix ne quitte jamais la machine** — Parakeet transcrit en local. Ça reste vrai, sans réserve.
- **La phrase transcrite part chez Scenario**, avec la liste des outils et l'état courant.

Le réglage doit dire les deux, séparément. « Rien ne sort » deviendrait un mensonge, et un mensonge
dans un réglage de vie privée est pire que l'absence de réglage.

---

## L'architecture

```
     🎤  ou  ⌨️                        ← deux entrées, un seul chemin
      │
      ▼
  Parakeet — utilityProcess, local     ← LIVRÉ, inchangé
      │  « mets cheval au galop dans le prompt du générateur »
      ▼
  Registre d'outils                    ← À ÉCRIRE — le vrai travail
  (schémas + niveau de confirmation + état courant)
      │
      ▼
  generate.runModel('model_scenario-llm', { instruction, model })
      │       via JobManager, comme toute autre génération
      │  {"tool":"field.set","input":{…},"confidence":0.95,"say":"…"}
      ▼
  Validation zod                       ← validation.ts fait déjà ça
      │
      ▼
  Confirmation si l'outil l'exige (avec le coût estimé)
      │
      ▼
  Exécution via les canaux IPC typés existants
```

**Le renderer ne voit toujours aucun secret.** L'instruction se compose dans le main, l'appel part du
main, la clé n'en sort pas. L'invariant 1 est intact.

---

## Le registre d'outils

Le cœur du chantier. Chaque outil porte : un nom, une description **écrite pour une machine**, un
schéma d'entrée, et son niveau de confirmation.

| Outil | Confirmation | Pourquoi |
|---|---|---|
| `workspace.open({id})` | directe | réversible, gratuit |
| `model.select({query})` | directe | réversible, gratuit |
| `field.set({target, value})` | directe | réversible, gratuit, et c'est le geste de l'entrée 41 |
| `job.cancel({})` | directe | une confirmation d'annulation use, et l'annulation ne détruit rien |
| `prompt.draft({target})` | directe | **0 UC mesuré** ; passe par `PromptAssist.suggest()` |
| `image.generate({…})` | **confirmée, coût affiché** | 12 UC mesuré, irréversible côté facturation |
| `project.create({name})` | **confirmée** | écrit sur le disque |
| `asset.remove({id})` | **confirmée** | définitif |

**`field.set` et `prompt.draft` sont les deux outils que la demande a fait apparaître** — « saisis tel
texte dans telle partie de l'app », « génère-moi le texte pour le générateur d'image ». Le second
délègue à `PromptAssist.suggest()` (`src/main/scenario/prompt-assist.ts`), déjà branché sur l'IPC
`scenario:suggest-prompts`, **gratuit**, et qui rend en plus des paramètres conformes au modèle visé
parce qu'il reçoit ses `FieldDescriptor[]`.

**Les `target` sont un vocabulaire fermé et traduit**, pas des sélecteurs CSS : `generator.prompt`,
`generator.negativePrompt`, `apps.<id>.<field>`. Un `target` inconnu est un échec propre, dit à
l'écran — jamais une écriture au hasard.

**L'état courant envoyé avec chaque appel** : projet ouvert, espace actif, modèle courant, présence
d'un job en cours, et les cibles disponibles à cet instant. C'est ce qui a permis au modèle de
refuser proprement la phrase 5 du test.

---

## Les étapes

Chacune se livre seule, avec la Definition of Done de `CLAUDE.md` : tests colocalisés écrits **avec**
le code → `pnpm validate` vert → `/simplify` → `/code-review` → commit. Rebase sur `develop` local
après chaque étape.

### Étape 1 — le registre d'outils, pilotable au clavier

Aucun appel réseau, aucune voix. Une barre où l'on tape le nom d'un outil et ses arguments, qui
exécute pour de vrai.

- `shared/domain/assistant.ts` : le type d'un outil, son schéma, son niveau de confirmation.
- Le registre, dérivé de `shared/domain/command.ts` et des canaux de `shared/ipc.ts` — **dérivé, pas
  recopié** : deux listes qui divergent sont une seule liste écrite deux fois.
- La collecte de l'état courant.
- L'exécution, et la confirmation portant le coût de `costEstimatorOf`.

**Fin d'étape** : taper `field.set generator.prompt "un cheval"` écrit dans le champ, sans micro et
sans un octet envoyé. Un `target` inconnu affiche un échec lisible.

### Étape 2 — le cerveau

- L'appel `generate.runModel('model_scenario-llm', …)` via le `JobManager`.
- La composition de l'instruction : rôle, catalogue, état, format de sortie attendu.
- La validation zod de la réponse, et le chemin `tool: null`.
- Le réglage de modèle, construit depuis `allowed_values` du schéma.
- **Le ménage des assets texte** — voir les pièges.
- **La mesure** : latence d'un aller-retour, et taux d'erreur sur au moins trente phrases écrites à
  l'avance, dont dix hors périmètre. Les chiffres reviennent ici.

**Fin d'étape** : taper une phrase en français dans la barre déclenche le bon outil.

### Étape 3 — la surface

- Le bouton unique dans la coquille, à côté de `DictationStatus`.
- Le raccourci — `app.assist`, `held`, sur le modèle exact d'`app.dictate`.
- Le retour à l'écran : ce qui a été entendu, ce qui va être fait, ce qui a échoué.
- Les confirmations.

**Fin d'étape** : la capture d'écran du § 8 de `docs/todo.md`, prise sur l'application lancée.

### Étape 4 — le retrait des micros par champ

**En dernier**, quand le remplacement a fait ses preuves. `DictationField`, `dictationAccessory` et
l'accroche dans `Generator` et `Apps` partent. `insertAtCaret` **reste** : c'est ce qui exécute
`field.set`, et ses tests sont bons.

**Fin d'étape** : l'entrée 41 de `docs/todo.md` se ferme, et le geste qu'elle décrivait fonctionne
enfin — par un autre chemin que celui qu'elle proposait.

---

## Les pièges, connus d'avance

**Chaque appel crée un asset texte dans le projet Scenario.** Mesuré : le test a produit
`asset_Yx8i7kuknqQPXkk2Xtreo1Dt`, `type: txt2txt`, dans le catalogue. Cinquante commandes font
cinquante assets parasites dans l'Explorateur. À traiter à l'étape 2 — filtrage à l'affichage,
suppression après lecture, ou les deux. **Ne pas découvrir ça en production.**

**Le texte de la réponse est dans les métadonnées, pas au bout de l'URL.** L'asset porte
`metadata.preview` avec le texte entier et `hasFullPreview: true` (711 caractères au test). Au-delà
d'un seuil non mesuré, `hasFullPreview` passe faux et il faut aller chercher l'URL CDN — qui est
signée et expire. **Traiter les deux cas dès l'écriture**, sinon la première réponse longue casse en
silence.

**`textInputs` et `images` veulent un tableau même pour une valeur.** Le schéma le dit lui-même :
« a bare value is ignored » — ignoré, pas rejeté. Une valeur nue ne lève rien et ne fait rien.

**Le format de sortie n'est pas garanti par l'API.** Il n'y a pas de sortie structurée native : le
JSON est demandé en prose. Il a tenu six fois sur six, ce qui ne prouve rien. La validation zod est
obligatoire, et le chemin « réponse illisible » doit exister avant la première démo.

**`wait` plafonne à 180 s.** Au-delà, un `job_id` revient et il faut poller — ce que seul le
`JobManager` a le droit de faire.

**Ne pas confondre `prompt.draft` et le routeur.** Le premier est gratuit et déjà branché ; le second
coûte 0,75 UC. Router une demande de prompt vers le LLM générique paierait pour ce qui est offert.

---

## Ce qui n'est pas mesuré, et qu'il ne faut pas présenter comme acquis

- **La latence.** L'appel de test est revenu en quelques secondes, sans chronomètre. Aucun chiffre
  honnête à ce jour. Elle décide du design de l'attente à l'écran.
- **Le taux d'erreur.** Six phrases choisies par moi, sur cinq outils. Ni un vocabulaire réel, ni un
  registre d'outils réel.
- **Le comportement des neuf autres LLM.** Seul `claude-haiku-4-5` a été essayé.
- **Le seuil de `hasFullPreview`.** Connu vrai à 711 caractères, inconnu au-delà.
- **La qualité de la transcription sur du vocabulaire de commande.** Parakeet a été éprouvé sur de la
  prose dictée, pas sur « passe en 3D » ou des noms de modèles.

---

## Hors périmètre

- **La synthèse vocale.** L'assistant répond par écrit. Rien ne l'exclut plus tard ; rien ne le
  demande aujourd'hui.
- **Les enchaînements multi-tours** (« et maintenant la même en plus sombre »). Le test montre que le
  modèle refuse proprement faute d'état — c'est le bon comportement pour une v1. La mémoire de
  conversation est un chantier à elle seule.
- **Piloter la timeline, le graphe ou la 3D à la voix.** Le registre commence par ce qui se dit
  naturellement ; viser des gestes continus à la voix est une autre nature de problème.
- **Un LLM local.** Écarté avec l'utilisateur : 3 à 8 Go en plus des 640 Mo de Parakeet, pour un
  tool-calling moins fiable.
