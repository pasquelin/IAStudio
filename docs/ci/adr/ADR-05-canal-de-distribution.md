# ADR-05 — Canal de distribution et auto-update

- **Statut** : Accepté
- **Date** : 2026-08-08

## Contexte

Le dépôt `pasquelin/scenario` est **public**. `electron-builder` intègre la publication vers les
GitHub Releases, et `electron-updater` sait les consommer sans configuration serveur.

## Décision

GitHub Releases comme **unique** canal. `electron-updater` pointe dessus via le bloc
`publish: { provider: github }` de `electron-builder.yml`, qui sert à la fois à la publication
et à la génération des manifestes `latest.yml`, `latest-mac.yml`, `latest-linux.yml`.

Aucun serveur de mise à jour dédié.

## Alternatives écartées

- **Serveur générique auto-hébergé** (`provider: generic`) : infrastructure à maintenir,
  disponibilité à garantir, pour un bénéfice nul tant que le dépôt est public.
- **Dépôt public séparé dédié aux releases** : la parade au cas d'un dépôt privé, où l'auto-update
  exigerait un token côté client — un anti-pattern, puisque le token voyagerait dans l'application.
  Sans objet ici.

## Conséquences

- Aucun secret n'est nécessaire côté client pour se mettre à jour.
- **Si le dépôt devenait privé, l'auto-update cesserait de fonctionner** pour toute la base
  installée. Passer le dépôt en privé exigerait un amendement de cet ADR et un dépôt public
  dédié aux releases.
- La release est créée en `draft` (ADR-06) : tant qu'elle n'est pas publiée, aucun client ne la
  voit. La publication manuelle est le dernier verrou avant que la base installée ne bouge.
