# Accueil — vérification manuelle

Ce que les tests ne peuvent pas dire : ce que l’écran donne envie de faire. À passer avant
chaque fusion touchant `src/renderer/src/home/` ou `design/Carousel.tsx`.

Les tests automatiques couvrent le reste : `src/shared/domain/home.test.ts` tient la promesse
« jamais vide » sur toute la matrice, `design/Carousel.test.tsx` tient la virtualisation, les
flèches, les pastilles et le mouvement réduit, `home/HomeView.test.tsx` tient l’assemblage.

---

## 1. Premier lancement — ni clé, ni projet

C’est l’état où la maquette de référence serait vide. Le nôtre ne doit pas l’être.

Pour le reproduire : renommer `secrets/.env`, et dans les préférences retirer le compte actif.

| Geste | Attendu |
|---|---|
| Ouvrir le studio | La home s’ouvre d’elle-même, sur la bannière **Connecter une clé API** |
| Lire la page | Trois bandes au moins : bannière, **Outils**, **Vos projets** |
| Cliquer « Saisir ma clé API » | Les préférences s’ouvrent sur **Compte** |
| Chercher une section vide | Il n’y en a aucune. Ni « aucun résultat », ni bloc de chargement resté là |
| Regarder « Vos projets » | Le cadre pointillé invite à créer, il n’annonce pas une liste vide |

## 2. Clé connectée, projet vide

| Geste | Attendu |
|---|---|
| Remettre `secrets/.env`, relancer | La barre affiche le compte en vert, la bannière clé a disparu |
| Lire la bannière | **Tout est prêt**, nommant le projet ouvert |
| Cliquer « Créer une image » | L’espace Image s’ouvre sur un document neuf, la home se referme |

## 3. Projet au travail

| Geste | Attendu |
|---|---|
| Revenir à l’accueil | La bannière propose **Reprendre**, en nommant le document et le projet |
| Cliquer « Reprendre » | Le bon espace s’ouvre, sur le bon onglet |
| Lancer une génération, revenir | La bande **En cours** liste la tâche et sa progression ; « Annuler » l’arrête |
| Provoquer un échec (clé invalide) | Il apparaît dans **Activité récente**, en rouge, horodaté |

## 4. Les carrousels

Sur une section qui déborde — au besoin, ouvrir plusieurs documents.

| Geste | Attendu |
|---|---|
| Molette / trackpad horizontal | Le rail défile, sans à-coup, et s’accroche aux cartes |
| Survoler le rail | Les flèches apparaissent ; celle d’un bord atteint disparaît, elle ne grise pas |
| Cliquer une flèche | Le rail avance d’une page en gardant un morceau de la précédente |
| Cliquer une pastille | Le rail va à cette page ; la pastille active suit le défilement |
| `Tab` jusqu’au rail puis `←`/`→` | Le rail bouge d’une carte. `Début`/`Fin` vont aux extrémités |
| Regarder le focus | L’anneau d’accent est visible sur le rail et sur chaque carte |
| Élargir/rétrécir la fenêtre | Le nombre de pastilles suit ; rien ne saute |

## 5. Mouvement réduit et densité

| Geste | Attendu |
|---|---|
| Préférences ▸ Apparence ▸ Mouvement réduit | Flèches et pastilles déplacent le rail **sans** animation |
| Densité compacte | Les cartes gardent leurs proportions, rien ne se chevauche |
| Échelle de texte à 1,4 | Les descriptions des outils ne débordent pas de leur carte |

## 6. Personnalisation

| Geste | Attendu |
|---|---|
| Survoler un titre de bande | Le bouton **⋯** apparaît ; il disparaît quand le pointeur sort |
| ⋯ ▸ Descendre | La bande passe sous la suivante, immédiatement |
| ⋯ sur la première bande titrée | **Monter** est grisé, pas absent |
| ⋯ ▸ Masquer | La bande disparaît ; le pied annonce « 1 section masquée » |
| Pied ▸ « Les réafficher » | Elle revient à sa place |
| ⋯ ▸ Afficher 6 éléments | Le carrousel se réduit ; la coche marque la valeur retenue |
| Relancer l’application | L’ordre, les masquages et les limites sont ceux qu’on a laissés |
| ⋯ sur **Outils** ou **Vos projets** | **Masquer** n’est pas proposé — elles sont épinglées |

## 7. L’interrupteur global

| Geste | Attendu |
|---|---|
| Préférences ▸ Général ▸ Afficher l’accueil, décocher | Le bouton **Accueil** quitte la barre de titre ; le studio revient à son espace |
| Recocher | Le bouton revient ; il ouvre la home telle qu’on l’avait laissée |

## 8. Les quatre états d’erreur

| Cas | Comment le provoquer | Attendu |
|---|---|---|
| Pas de clé | Retirer le compte actif | Bannière d’invitation, sections réseau retirées, sections locales intactes |
| Clé invalide | Saisir une clé bidon | Idem, plus une ligne dans **Activité récente** |
| Quota dépassé | Difficile à provoquer | Le journal le dit ; la home reste entière |
| Hors ligne | Couper le réseau | Les bandes locales — outils, projets, documents, journal — restent lisibles |

Dans les quatre cas, la règle est la même : **une section qui ne peut pas se remplir se retire,
elle ne s’affiche pas vide, et elle n’emporte pas la page avec elle.**

## 9. Le shell

| Geste | Attendu |
|---|---|
| Home ouverte | Aucun rail, aucun panneau, aucune poignée de redimensionnement |
| Home ouverte, regarder le bas | La ligne d’état est toujours là — tâches, journal, mise à jour |
| Menu natif ▸ Fenêtres d’outils | Les entrées sont grisées tant que la home est devant |
| Quitter puis revenir à l’accueil | L’espace retrouvé est celui qu’on avait quitté, avec ses onglets |
