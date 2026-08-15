# ADR-07 — Convention de nommage des secrets

- **Statut** : Accepté
- **Date** : 2026-08-08

## Contexte

Les secrets de signature n’existent pas encore (ADR-04), mais les workflows doivent déjà les
lire aux bons noms — sans quoi leur arrivée imposerait de rouvrir les workflows, c’est-à-dire de
retester tout le pipeline pour une question de nommage.

## Décision

Liste **exhaustive et figée**. Aucun secret hors de cette liste sans amendement de cet ADR.

| Nom | Rôle | Job consommateur |
|---|---|---|
| `APPLE_API_KEY_P8_BASE64` | Clé API App Store Connect (`.p8`), encodée en base64 | `build` / macOS |
| `APPLE_API_KEY_ID` | Identifiant de cette clé | `build` / macOS |
| `APPLE_API_ISSUER` | Identifiant d’émetteur du compte | `build` / macOS |
| `APPLE_TEAM_ID` | Team ID Apple Developer | `build` / macOS |
| `MAC_CERT_P12_BASE64` | Certificat Developer ID Application (`.p12`), base64 | `build` / macOS |
| `MAC_CERT_PASSWORD` | Mot de passe de ce `.p12` | `build` / macOS |
| `WIN_CERT_P12_BASE64` | Certificat de signature de code Windows, base64 | `build` / Windows |
| `WIN_CERT_PASSWORD` | Mot de passe de ce certificat | `build` / Windows |

`GITHUB_TOKEN` est fourni par la plateforme et n’a pas à être créé.

Le `.p12` et la clé `.p8` sont **encodés en base64** parce qu’un secret GitHub est une chaîne de
texte : un binaire brut n’y survit pas.

## Alternatives écartées

- **Noms hérités de `secrets/.env`** (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`) : le mot de passe
  applicatif est lié au mot de passe du compte et se révoque mal. ADR-04 retient la clé API.
  Le fichier local garde ses noms — il sert un autre usage, la signature depuis le poste.
- **Noms attendus nativement par `electron-builder`** (`CSC_LINK`, `CSC_KEY_PASSWORD`) : nommer
  d’après l’outil plutôt que d’après le contenu rend impossible de distinguer macOS de Windows,
  et la traduction se fait en une ligne d'`env:` dans le workflow.
- **Variables Azure Artifact Signing** : hors périmètre tant qu’aucune entité juridique n’existe
  (ADR-04). Les ajouter exigera un amendement.

## Conséquences

- Les workflows référencent ces noms dès maintenant. Un secret absent laisse la variable vide,
  ce qui déclenche le mode non signé — jamais un échec.
- `docs/ci/SECRETS.md` documente pour chacun sa procédure d’obtention, son encodage et sa
  rotation. Les valeurs d’exemple qui y figurent sont **fictives et signalées comme telles**.
