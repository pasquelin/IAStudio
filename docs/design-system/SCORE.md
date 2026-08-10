# SCORE

Courant : 28 (dette 189 · 264 composants) — itération 13, 2026-08-10

Le score s'est effondré à l'itération 4 parce qu'un invariant venait d'être déclaré, pas
parce que le code avait régressé.

**La dette remonte à l'itération 10 sans qu'aucun bouton n'ait été ajouté** : le recensement
des itérations 4 à 9 ne comptait que les `<button>` bruts et les `<ToolButton>`, et manquait
les 10 appels à `<Button>` et les 27 rangées de `<MenuRow>`. Le chiffre corrigé est plus
haut ; il n'est pas plus mauvais. Ne pas lisser vaut aussi pour ça.

**Le score repasse au-dessus de zéro pour la première fois depuis l'itération 4.** Onze
rangées fermées, mais aussi deux lignes retirées du journal parce que d'autres branches les
avaient corrigées, et une ligne ajoutée que ce lot a rendue visible — le détail est dans
`DRIFT_LOG.md`, section par section.

| # | Date | Score | Dette | P0 | P1 | P2 | Lot traité |
|---|---|---|---|---|---|---|---|
| 13 | 2026-08-10 | 28 | 189 | 18 | 3 | 0 | les onze rangées de menu de la coque : onglets, barre de titre, comptes, sections de l'accueil |
| 12 | 2026-08-10 | 0 | 319 | 31 | 3 | 0 | les dix appels à `<Button>` — il n'en reste aucun |
| 11 | 2026-08-10 | 0 | 373 | 37 | 1 | 0 | les huit derniers `<button>` bruts — il n'en reste aucun |
| 10 | 2026-08-10 | 0 | 463 | 46 | 1 | 0 | neuf boutons des docks et de la ligne d'état — et le recensement corrigé |
| 9 | 2026-08-10 | 0 | 173 | 17 | 1 | 0 | les dix-sept boutons à libellé des Préférences |
| 8 | 2026-08-10 | 0 | 343 | 34 | 1 | 0 | fenêtre Licences : son hôte, et le geste que sa rangée offre |
| 7 | 2026-08-10 | 0 | 353 | 35 | 1 | 0 | les onze boutons à icône de la fenêtre principale |
| 6 | 2026-08-10 | 0 | 460 | 46 | 0 | 0 | fenêtre Usage : son hôte, ses cinq boutons, et les fabriques `HINT_*` |
| 5 | 2026-08-10 | 0 | 510 | 51 | 0 | 0 | les Préférences montent leur hôte, deux `title` natifs convertis |
| 4 | 2026-08-10 | 0 | 530 | 53 | 0 | 0 | infobulle obligatoire sur `ToolButton`, 12 sites câblés |
| 3 | 2026-08-10 | 100 | 0 | 0 | 0 | 0 | gabarit de classes de `Row` |
| 2 | 2026-08-10 | 99 | 3 | 0 | 1 | 0 | accroche du carrousel dite en classes |
| 1 | 2026-08-10 | 96 | 9 | 0 | 3 | 0 | peau des boutons révélés au survol d'une étagère |
| 0 | 2026-08-10 | 94 | 15 | 0 | 5 | 0 | état initial, avant tout lot |

## P2 laissés à l'arbitrage

Aucun.
