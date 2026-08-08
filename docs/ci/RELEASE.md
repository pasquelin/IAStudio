# Publier une version

Check-list exécutable sans réfléchir. Chaque étape est vérifiable ; aucune ne se saute.

Rappel du modèle de branches ([ADR-15](adr/ADR-15-modele-de-branches.md)) : **`develop` intègre,
`main` publie**. Un tag `v*` posé sur `main` déclenche le pipeline.

---

## Avant la première release — à faire une seule fois

1. **Publier les branches et basculer la branche par défaut.**

   ```bash
   git push origin main develop
   gh repo edit --default-branch develop
   ```

   Tant que ce n'est pas fait, les workflows ne peuvent pas s'exécuter.

2. **Vérifier le pipeline à blanc**, avant tout tag :

   ```bash
   gh workflow run release.yml -f dry_run=true
   gh run watch
   ```

   Attendu : trois artefacts (`installers-mac`, `installers-win`, `installers-linux`), **aucune
   release créée**. Télécharger le `.dmg` et le lancer sur le Mac confirme que le paquet démarre.

---

## Publier

1. **Partir d'un `develop` vert.** `pnpm validate` doit passer, et la CI être au vert sur
   `develop`.

2. **Aligner la version** dans `package.json`. Elle doit correspondre **exactement** au tag, sans
   le `v` :

   ```bash
   # pour publier v0.2.0
   npm version 0.2.0 --no-git-tag-version
   ```

   Un désalignement produit des manifestes d'auto-update dont la version ne correspond pas au nom
   du tag — l'auto-update part alors en boucle ou ne voit rien.

3. **Mettre à jour le changelog**, puis committer :

   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore(release): 0.2.0"
   ```

4. **Fusionner dans `main`.** C'est le seul type de merge que `main` accepte :

   ```bash
   git checkout main
   git merge --no-ff develop -m "Release 0.2.0"
   ```

5. **Taguer et pousser.** Le tag est la source de vérité de la version :

   ```bash
   git tag v0.2.0
   git push origin main develop v0.2.0
   ```

6. **Suivre le run.**

   ```bash
   gh run watch
   ```

   Le job `build` tourne sur les trois OS, puis `release` agrège et crée la draft. Un échec de
   `release` avec « Missing update manifests » signifie qu'une plateforme n'a pas produit son
   `latest*.yml` : c'est une protection, pas un caprice — [ADR-06](adr/ADR-06-publication-des-artefacts.md).

7. **Vérifier la draft** avant de la publier :

   ```bash
   gh release view v0.2.0
   ```

   Attendu, sept fichiers plus les manifestes :

   | Fichier | Plateforme |
   |---|---|
   | `scenario-studio-0.2.0-mac-arm64.dmg` / `.zip` | macOS Apple Silicon |
   | `scenario-studio-0.2.0-mac-x64.dmg` / `.zip` | macOS Intel |
   | `scenario-studio-0.2.0-win-x64.exe` | Windows |
   | `scenario-studio-0.2.0-linux-x64.AppImage` / `.deb` | Linux |
   | `latest.yml`, `latest-mac.yml`, `latest-linux.yml` | manifestes d'auto-update |

   Contrôler que les tailles sont cohérentes (170–240 Mo par installeur) et que les manifestes
   portent bien `version: 0.2.0`.

8. **Publier**, depuis l'interface GitHub ou :

   ```bash
   gh release edit v0.2.0 --draft=false
   ```

   **C'est ce geste, et lui seul, qui déclenche la mise à jour de la base installée.**

---

## Revenir en arrière

Une release publiée par erreur se dépublie ; un tag se retire. Dans cet ordre :

```bash
gh release edit v0.2.0 --draft=true      # la retire de la vue publique et de l'auto-update
gh release delete v0.2.0 --yes           # si elle doit disparaître entièrement
git push origin :refs/tags/v0.2.0        # retire le tag distant
git tag -d v0.2.0                        # et le tag local
```

**Repasser la release en draft suffit à arrêter la diffusion** : `electron-updater` ne voit que
les releases publiées. Le faire d'abord, réfléchir ensuite.

Un client qui a déjà téléchargé la version l'installera au prochain quit — une release retirée ne
rappelle pas ce qui est parti. La parade est de publier **une version supérieure** corrigée, pas
d'espérer que le retrait suffise.

---

## Rotation de ffmpeg

Épinglé par URL versionnée et somme de contrôle ([ADR-12](adr/ADR-12-ffmpeg-epinglage-et-concurrence.md)).
Changer de build est un geste délibéré en trois temps :

```bash
# 1. changer les URL dans scripts/fetch-ffmpeg.mjs (et BTBN_VERSION / BTBN_BUILD)
# 2. recalculer les empreintes des cinq cibles
node scripts/fetch-ffmpeg.mjs --digests
# 3. recopier la sortie dans les champs `digests` de TARGETS, puis
pnpm licences:collect                    # le relevé de licences lit ces mêmes cibles
pnpm validate
```

Changer l'URL sans l'empreinte fait échouer le build au packaging — c'est voulu.
