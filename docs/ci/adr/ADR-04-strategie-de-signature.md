# ADR-04 — Stratégie de signature

- **Statut** : Accepté
- **Date** : 2026-08-08

## Contexte

Aucun compte Apple Developer Program n’est souscrit. Aucune entité juridique n’est immatriculée,
ce qui exclut Azure Artifact Signing : depuis l’UE, l’offre est réservée aux organisations, les
développeurs en nom propre restant restreints aux États-Unis et au Canada.

Le pipeline doit néanmoins être livré, et le rester utilisable le jour où ces éléments existent.

## Décision

**Mise en œuvre échelonnée. Le pipeline est livré en mode non signé et le signale.**

- **macOS** : ni signature ni notarisation. `CSC_IDENTITY_AUTO_DISCOVERY=false` est forcé quand
  les secrets sont absents, et `mac.notarize: false` est déclaré explicitement. Le résumé du run
  affiche une ligne indiquant que le build n’est pas signé.
- **Windows** : pas de signature Authenticode. SmartScreen avertira à l’installation.
- **Linux** : aucune signature requise pour `AppImage` et `deb`.

L’activation se fait **par simple ajout des secrets** nommés en ADR-07, sans modifier les
workflows. Quand un compte Apple existera, privilégier l’authentification par **clé API App
Store Connect** plutôt que par mot de passe applicatif : révocable, sans lien avec le mot de
passe du compte, et plus stable en CI.

## Alternatives écartées

- **Bloquer la livraison jusqu’à l’achat des certificats** : le pipeline est justement ce qui
  permet de tester avant de payer.
- **Certificat OV Windows immédiat** : depuis juin 2023 la clé privée doit résider sur un token
  matériel ou un HSM cloud, ce qui impose une offre de signature cloud (eSigner, KeyLocker) et
  une rotation annuelle (460 jours maximum depuis mars 2026). Coût et servitude disproportionnés
  tant que rien n’est distribué publiquement.
- **Signature ad-hoc macOS** : ne satisfait pas Gatekeeper, et donne l’illusion d’être signé.

## Conséquences

- Un utilisateur macOS devra contourner Gatekeeper (clic droit → Ouvrir) ; un utilisateur
  Windows devra passer l’avertissement SmartScreen. **Acceptable en phase de test, pas en
  distribution publique** — c’est la dette explicite de cette décision.
- **Conséquence la plus lourde, et la moins visible : sans signature, l’auto-update n’a aucune
  vérification cryptographique.** `electron-updater` compare le `sha512` du manifeste, mais ce
  condensat est produit par le même run non signé : il garantit l’intégrité du transfert, pas
  l’authenticité de l’éditeur. Sur macOS, Squirrel exige normalement une application signée ;
  sur Windows, `verifyUpdateCodeSignature` compare les signataires de l’ancien et du nouveau
  binaire — sans signature des deux côtés, il n’y a rien à comparer.

  La seule barrière restante est le contrôle d’accès en écriture au dépôt GitHub, plus le geste
  humain de publier la draft. **Tant que la signature n’est pas active, ce canal ne doit servir
  qu’à un cercle de test.** `RELEASE.md` porte l’avertissement au-dessus de la procédure, pour
  qu’il ne vive pas seulement dans cet ADR.
- Les actions GitHub sont épinglées à un **tag majeur, qui est mutable**. C’est sans enjeu
  aujourd’hui, puisque aucun secret n’existe. **Le jour où les certificats sont provisionnés,
  `release.yml` manipule du matériel de signature dans l’environnement d’un job : les actions
  devront alors être épinglées au SHA.** C’est un prérequis d’activation, noté dans `SECRETS.md`.
- `docs/ci/SECRETS.md` documente la procédure complète d’obtention, pour que l’activation soit
  une formalité et non une redécouverte.
- Le job macOS reçoit un `timeout-minutes` large dès maintenant : la notarisation est asynchrone
  et parfois lente côté Apple, et le jour où elle s’active ce n’est pas le moment de découvrir
  que le timeout est trop court.

---

## Amendement du 17 août 2026 — `mac.notarize` n’est pas épinglé, et ne doit pas l’être

**La § Décision annonce que « `mac.notarize: false` est déclaré explicitement ». Il ne l’est pas**,
et c’est délibéré : `electron-builder.yml:111` laisse la clé à son défaut, la raison écrite en
commentaire au-dessus.

electron-builder ne notarise que ce qu’il a réussi à signer. Une build sans certificat saute donc
l’étape d’elle-même, sans qu’aucune clé ait à le lui dire. L’épingler à `false` coûterait
exactement ce que la § Décision exige quelques lignes plus bas : **l’activation par simple ajout
des secrets d’ADR-07**. Une valeur figée dans un fichier que personne ne pensera à rouvrir le jour
venu transforme cette promesse en panne silencieuse — un build signé qui ne se notarise pas.

**Le reste de la § Décision est vérifié au 17/08 et reste vrai** :
`CSC_IDENTITY_AUTO_DISCOVERY=false` est bien forcé (`.github/workflows/release.yml:146`), et le
résumé du run porte bien l’avertissement de build non signée (étape « Report signing status », même
fichier).
