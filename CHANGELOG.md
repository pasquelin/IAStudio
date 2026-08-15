# Journal des versions

Format [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), numérotation
[semver](https://semver.org/lang/fr/).

**Le tag fait foi**, et `package.json` porte le même numéro sans le `v`. La section d'une version
est extraite telle quelle par le job `release` et **devient le corps de la release GitHub** — une
version taguée sans sa section ici fait échouer la publication, délibérément. La procédure est
dans [`docs/ci/RELEASE.md`](docs/ci/RELEASE.md), la règle d'extraction dans
`src/main/release-notes.ts`.

Conséquence sur l'écriture : **dans une section de version, les liens sont absolus.** Une page de
release ne résout pas les chemins relatifs du dépôt, et ces liens-là sont les premiers qu'un
lecteur ouvre. Le préambule que voici n'est jamais publié et s'autorise donc le relatif.

## [0.1.0] — 2026-08-15

Première version publiée. Le studio est complet dans ses six espaces ; ce qui lui manque encore
est écrit noir sur blanc au chapitre
[Ce qui n'existe pas encore](https://github.com/pasquelin/scenario/blob/HEAD/docs/fr/manuel/18-limites.md),
qui est fait pour être lu.

> **Les installeurs ne sont pas signés.** Ni certificat Apple, ni certificat Windows n'est
> provisionné à ce jour
> ([ADR-04](https://github.com/pasquelin/scenario/blob/HEAD/docs/ci/adr/ADR-04-strategie-de-signature.md)) : macOS opposera
> Gatekeeper, Windows affichera SmartScreen. L'auto-update vérifie le condensat du manifeste —
> il garantit qu'un téléchargement n'a pas été corrompu, pas qu'il vient de nous.

### Ajouté

**Six espaces de travail**, entre lesquels la fenêtre se réarrange au lieu de changer de logiciel :
Image, Vidéo, 3D, Audio, Textures et Skyboxes. Le catalogue de modèles se filtre sur ce que
l'espace courant sait fabriquer.

**Les projets vivent sur votre disque**, dans un dossier ordinaire qui se copie, s'envoie et
s'ouvre dans l'explorateur. Les six types de documents s'y enregistrent et s'y rouvrent tels
quels. Rien ne repart : la génération est distante, le travail est local.

**Aucun formulaire de génération n'est écrit à la main.** Les entrées de chaque modèle sont
découvertes par l'API et rendues à la volée, si bien qu'un modèle nouveau ou un paramètre inconnu
apparaît sans mise à jour de l'application.

**Une file de génération unique**, à concurrence bornée et réglable, qui rapporte sa progression
et s'annule. Chaque asset garde le modèle, le prompt et la graine qui l'ont produit, et un bouton
les rejoue.

**Un assistant conversationnel** posé sur le studio, avec dictée : la reconnaissance vocale tourne
sur la machine, hors du processus principal
([ADR-17](https://github.com/pasquelin/scenario/blob/HEAD/docs/ci/adr/ADR-17-moteur-de-dictee-hors-processus.md)).

**Le studio se pilote de l'extérieur** par un serveur MCP —
[chapitre 20](https://github.com/pasquelin/scenario/blob/HEAD/docs/fr/manuel/20-piloter-de-l-exterieur.md).

**Le manuel est dans l'application**, pas seulement sur le dépôt : vingt chapitres sous
Aide ▸ Manuel utilisateur, en français et en anglais.

**Français et anglais de bout en bout**, densité compacte ou confortable, échelle de texte
réglable.

**Cinq installeurs** produits par la même chaîne à chaque version — macOS Apple Silicon et Intel,
Windows x64, Linux AppImage et deb — avec mise à jour automatique.

### Sécurité

La clé et le secret d'API ne quittent jamais le processus principal, chiffrés par le trousseau du
système. La fenêtre demande « suis-je authentifié ? », jamais « quelle est ma clé ? ».

### Limites connues

- L'historique d'annulation ne survit pas à la fermeture d'un document.
- Les installeurs ne sont pas signés — voir l'encadré ci-dessus.
- La liste complète et par espace :
  [chapitre 18](https://github.com/pasquelin/scenario/blob/HEAD/docs/fr/manuel/18-limites.md).

[0.1.0]: https://github.com/pasquelin/scenario/releases/tag/v0.1.0
