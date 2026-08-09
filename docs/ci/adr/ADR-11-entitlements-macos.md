# ADR-11 — Entitlements macOS

- **Statut** : Accepté — amende le cadrage initial
- **Date** : 2026-08-08

## Contexte

Le cahier de mission demande que `build/entitlements.mac.plist` déclare
`com.apple.security.cs.allow-jit`, `allow-unsigned-executable-memory` et
`disable-library-validation` — la triade habituelle d’une application Electron sous hardened
runtime.

Le fichier existe déjà, ne déclare **que** `allow-jit`, et **documente le refus des deux autres**.
L’audit confirme cette lecture :

- Rien n’exécute de code depuis une page mémoire écrivable en dehors de V8, que `allow-jit`
  couvre. Il n’y a ni wasm chargé (les `.wasm` de pixi et three sont livrés mais jamais
  instanciés), ni interpréteur tiers.
- `@electron/osx-sign` signe tous les Mach-O du bundle, y compris les `.node` sortis de l’asar
  et les binaires ffmpeg listés dans `mac.binaries`. Rien ne charge de bibliothèque non signée.

Le cahier de mission le prévoit lui-même : ces entitlements ne s’ajoutent que « si l’audit
démontre que l’application les utilise ».

## Décision

**Les entitlements restent réduits à `com.apple.security.cs.allow-jit`.** Le fichier n’est pas
modifié.

## Alternatives écartées

- **Ajouter les deux entitlements par précaution** : un entitlement est un affaiblissement du
  hardened runtime. `disable-library-validation` autorise le chargement de bibliothèques signées
  par un tiers dans le processus de l’application — ce qui est précisément ce que le fuse
  `onlyLoadAppFromAsar` et la signature des `.node` cherchent à empêcher. Les accorder « au cas
  où » revient à défaire une protection pour un besoin qui n’existe pas.
- **Ajouter les entitlements réseau / caméra / micro** : l’audit n’a trouvé ni `getUserMedia`,
  ni `mediaDevices`, ni `desktopCapturer`, ni serveur en écoute. L’application n’ayant pas d’App
  Sandbox (distribution DMG directe), ces clés seraient de toute façon inertes.

## Conséquences

- Le jour où une dépendance exigerait l’un de ces entitlements, le symptôme sera un crash au
  chargement sur macOS **uniquement en build signé**, invisible en développement. Cet ADR est le
  premier endroit où regarder ; `TROUBLESHOOTING.md` y renvoie.
- Tout ajout d’entitlement passe par un amendement de cet ADR, avec le besoin démontré — pas par
  une modification silencieuse du `.plist`.

---

## Amendement du 9 août 2026 — le micro, pour la dictée

**Ajouté : `com.apple.security.device.audio-input`.** Les deux autres restent refusés.

La dictée vocale hors ligne enregistre depuis le micro : le renderer ouvre `getUserMedia`, et
c’est le besoin que cet ADR réclamait avant d’accorder quoi que ce soit.

**Une phrase de la version initiale était fausse, et le rester aurait coûté cher.** Elle range
les clés micro et caméra parmi celles que l’absence d’App Sandbox rend « de toute façon
inertes ». C’est vrai des entitlements *App Sandbox* — `network.client`, `files.user-selected`.
Ce ne l’est pas de `device.audio-input`, qui appartient à la famille *Resource Access* du
**hardened runtime**, lequel est bien activé (`hardenedRuntime: true`). Sans cette clé, une
build signée se voit refuser le micro par le runtime **alors que le développement fonctionne** :
exactement le symptôme que la section « Conséquences » annonçait, et le premier endroit où
regarder si la dictée ne dit rien sur une version installée.

Le fichier sert à la fois d’`entitlements` et d’`entitlementsInherit`, donc les processus helper
en héritent. C’est nécessaire : celui qui ouvre la capture est le renderer, pas le processus
principal.

**Ce qui accompagne l’ajout, et sans quoi il ne sert à rien** — `NSMicrophoneUsageDescription`
dans `mac.extendInfo`. L’entitlement autorise ; la clé Info.plist est ce que macOS exige pour
seulement *demander*, et son absence tue le processus au premier accès plutôt que d’afficher un
refus. Les deux se posent ensemble ou pas du tout.

`disable-library-validation` reste refusé, y compris pour le moteur de reconnaissance : ses
quatre bibliothèques sortent de l’asar et sont signées avec l’application, comme
`better-sqlite3` — c’est ce que `asarUnpack` et la signature du bundle servent à garantir.
Voir [`docs/stt/02-packaging.md`](../../stt/02-packaging.md).
