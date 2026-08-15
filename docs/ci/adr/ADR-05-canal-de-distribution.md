# ADR-05 — Canal de distribution et auto-update

- **Statut** : Accepté
- **Date** : 2026-08-08

## Contexte

`electron-builder` intègre la publication vers les GitHub Releases, et `electron-updater` sait
les consommer sans configuration serveur.

Le dépôt `pasquelin/scenario` est **public**, et c’est ce qui rend ce canal utilisable tel quel :
les assets d’une release privée exigent un jeton authentifié, que le client n’a pas.

## Décision

GitHub Releases comme **unique** canal. `electron-updater` pointe dessus via le bloc
`publish: { provider: github }` de `electron-builder.yml`, qui sert à la fois à la publication
et à la génération des manifestes `latest.yml`, `latest-mac.yml`, `latest-linux.yml`.

Aucun serveur de mise à jour dédié.

## Alternatives écartées

- **Serveur générique auto-hébergé** (`provider: generic`) : infrastructure à maintenir,
  disponibilité à garantir, pour un bénéfice nul tant que le dépôt est public.
- **Dépôt public séparé dédié aux releases** : la parade au cas d’un dépôt privé, où l’auto-update
  exigerait un token côté client — un anti-pattern, puisque le token voyagerait dans l’application.
  Sans objet ici.

## Conséquences

- Aucun secret n’est nécessaire côté client pour se mettre à jour.
- **La visibilité du dépôt est une dépendance du produit, pas un réglage d’hébergement.** Le
  dépôt est passé en privé quelques heures le 8 août 2026 : le packaging continuait de
  fonctionner, mais tout client aurait reçu un 404 sur `latest*.yml`. Le code encaisse ce cas
  sans bruit — `phase: 'failed'`, rien à l’écran, une ligne dans le journal — de sorte qu’une
  bascule accidentelle **ne se voit pas**. C’est la raison de l’écrire ici.
- Repasser le dépôt en privé casserait donc l’auto-update de toute la base installée, en silence.
  Si cela devait arriver durablement, il faudrait un dépôt public dédié aux seules releases — et
  un amendement de cet ADR.
- La release est créée en `draft` (ADR-06) : tant qu’elle n’est pas publiée, aucun client ne la
  voit. La publication manuelle est le dernier verrou avant que la base installée ne bouge.
