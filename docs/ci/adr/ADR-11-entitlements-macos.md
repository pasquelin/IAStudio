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
