# Phase 10 — comparaison des bancs

Mesure du 4 septembre 2026, branche `feat/assistant-mission-runtime`, modèle `deepseek-chat`.

## Banc historique

Le fichier `scripts/banc/assistant.banc.ts`, ses scénarios et ses oracles sont inchangés. Les deux
dernières campagnes complètes consignées sur le même modèle donnent 330/440 (75 %) et 317/440
(72 %), soit une référence centrale de 73,5 %. Une comparaison payante sur le même sous-ensemble
que le Mission Runtime donne 21/27 (78 %), 2 188 383 tokens, 72 actions et 82 rounds.

## Banc Mission Runtime

Le nouveau `pnpm banc:mission` traverse `MissionRuntime`, `AssistantContextBuilder`, `ActionIndex`,
le provider HTTP existant et le vrai exécuteur du studio. Il juge l’état final. Le cas 1.1 accepte
donc une réponse exacte tirée du contexte frais sans exiger `studio.state`. Le cas 57.4 accepte une
mémoire projet réellement écrite plutôt qu’un seul support de persistance imposé.

Trois passes sur neuf scénarios, 27 exécutions :

- réussite : 15/27, soit 56 % ;
- contexte : 432 371 caractères construits ;
- fournisseur : 420 358 tokens de prompt ;
- 97 rounds runtime et 100 appels HTTP au provider ;
- 77 actions exécutées, dont 47 relectures ou répétitions inutiles ;
- 1 164 candidats envoyés au total, 12 au maximum par round ;
- 97 recherches internes dans l’ActionIndex ;
- aucun appel `actions.find` ;
- aucun replan, conflit de révision, attente utilisateur ou attente job sur ce sous-ensemble ;
- concurrence maximale observée sur le sous-ensemble : une mission.

Les scénarios A à D sont couverts par les intégrations déterministes du runtime et du scheduler :
question/reprise, attente et rattachement de job, révision concurrente, disparition de cible et deux
missions concurrentes. Le banc payant cible E, c’est-à-dire la sélection d’actions par DeepSeek.

## Divergences

- 1.1 réussit sans action : le ContextBuilder fournit déjà un état frais. Ce n’est pas une
  régression fonctionnelle.
- 6.1 réussit 3/3 ; 6.2 réussit 2/3, contre 3/3 en legacy.
- 12.2 boucle sur la lecture de scène ou choisit une action de document Material au lieu de
  `node.setMeshMaterial`.
- 20.1 refuse la génération malgré les candidats ; le legacy réussit 1/3.
- 22.1 répète `models.search` sans achever le workflow ; le legacy réussit 1/3.
- 57.4 réussit 2/3 via une mémoire projet ; une passe affirme seulement avoir retenu l’information.
- 58.7 réussit 2/3 contre 3/3 ; une passe appelle `git.commit` au lieu d’initialiser le dépôt.
- 41.6 réussit 3/3.

Sur ce sous-ensemble identique, le Mission Runtime consomme 80,8 % de tokens en moins. Il exécute
cinq actions de plus, concentrées dans les boucles de 12.2 et 22.1. Son taux reste inférieur de 22
points au legacy et sous la référence historique. Le prochain travail doit porter sur les relations de workflow
entre actions et la fin des boucles de vérification, sans élargir de nouveau le catalogue complet.
