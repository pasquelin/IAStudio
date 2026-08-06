# Base de connaissance — API Scenario

Copie locale de la documentation Scenario au 6 août 2026, aspirée depuis `docs.scenario.com`.
209 pages. **Consulter ici en priorité plutôt que d'aller sur le web** : c'est plus rapide, et
c'est la version sur laquelle le code a été écrit.

Régénération : voir `scripts/fetch-scenario-docs.sh`.

## L'essentiel en dix lignes

- **Auth** : Basic HTTP, `Authorization: Basic base64(apiKey + ':' + apiSecret)`.
  Alternative : `bearerAuth` (JWT court) + `projectId` pour le multi-projets.
- **Le secret ne doit jamais atteindre le renderer.** Tout appel part du process main.
- **SDK officiel** : `@scenario-labs/sdk` (server-side TypeScript). Erreurs typées, retry
  exponentiel, auto-pagination, et `job.wait()` qui encapsule le polling.
- **Endpoint de génération unique** : `POST /generate/custom/{modelId}`, dont le corps est
  **propre à chaque modèle** et se découvre via `GET /models/{modelId}` → `inputs`.
  C'est ce qui impose le moteur de formulaires dynamiques (`ModelRegistry`).
- **Tout est asynchrone** : la réponse est un `Job` (`queued` → `in-progress` → `success`),
  avec `progress` de 0 à 1 et `metadata.assetIds` en sortie.
- **Erreurs** : 400 · 401 · 403 · 404 · 429 · 500, corps `{ status, code, message }`.
  429 et 5xx se retentent en backoff exponentiel.

## Où chercher quoi

| Question | Fichier |
|---|---|
| Comment j'authentifie ? | `guides/get-started/documentation/key-concepts-terminology/api-key-and-authentication.md` |
| Que veut dire Model / Job / Asset ? | `guides/get-started/documentation/key-concepts-terminology/core-terminology.md` |
| Quels codes d'erreur, quelle forme de réponse ? | `guides/get-started/documentation/understanding-api-responses-and-errors.md` |
| Tout ce que l'API sait faire | `guides/get-started/documentation/key-capabilities-at-a-glance.md` |
| Premiers appels de bout en bout | `guides/get-started/documentation/quick-start-guide/` |
| Signature exacte d'une méthode SDK | `reference/<ressource>.<méthode>.md` |
| Les helpers `.wait()`, `.download()`, `uploadFile()` | `guides/sdk-helpers.md` |
| Bearer auth et rafraîchissement JWT | `guides/sdk-helpers/auth.md` |
| Uploader un fichier | `guides/get-started/content/uploading-assets.md` |
| Récupérer l'URL d'un asset | `guides/get-started/content/retrieve-asset-url-by-asset-id.md` |
| Lister et filtrer les modèles | `guides/get-started/content/get-and-filter-models.md` |
| Entraîner un modèle, LoRA | `guides/get-started/training/` |
| CDN et diffusion des médias | `guides/get-started/documentation/content-delivery-network-cdn.md` |

## Ressources du SDK

`reference/` contient une page par méthode, nommée `<ressource>.<méthode>.md`
(les sous-ressources sont aplaties : `assets.download.request` → `assets.download.request.md`).

| Ressource | Méthodes |
|---|---|
| `assets` | list · retrieve · get_bulk · update · update_tags · upload · duplicate · lock · unlock · delete_multiple · list_snapshots |
| `assets.download` | request · request_batch · get_status |
| `collections` | create · list · retrieve · update · delete (+ `assets.add/remove`, `models.add/remove`) |
| `generate` | **run_model** · patch · caption · detect · embed · prompt · translate · describe_style |
| `jobs` | list · retrieve · trigger_action |
| `models` | list · retrieve · get_bulk · create · copy · update · update_tags · transfer · download · delete · delete_images |
| `models.train` | trigger · action |
| `models.training_images` | add · replace · replace_pairs · delete |
| `models.description` / `models.examples` | retrieve/update · list/update |
| `search` | asset_search · model_search |
| `uploads` | create · retrieve · trigger_action |
| `workflows` | create · list · retrieve · update · run · user_approval · get_tags · delete |
| `tags` · `usages` · `pricing.oscu` | list · list · retrieve_prices |

## Catalogue des modèles par famille

Un fichier par fournisseur sous `guides/get-started/generation/`.

| Famille | Fournisseurs documentés |
|---|---|
| **Image** (`third-party-model-generation/`) | Google · OpenAI · Meta · xAI · BFL · Ideogram · Recraft · Alibaba · ByteDance · Microsoft · Minimax · Luma Labs · Runway ML · Photoroom · Phota · Pruna AI · Retro Diffusion · Reve AI · Sourceful · Tencent · LongCat · Academia · Scenario |
| **Vidéo** (`video-generation/`) | Google · OpenAI · Meta · Runway · Luma · Pika · Kuaishou · Lightricks · ElevenLabs · HeyGen · Creatify · Character AI · Decart · Shengshu · Sync Labs · VEED · PixVerse · Pixa · Pixelcut · Alibaba · ByteDance · Minimax · Cartwheel · xAI · Sonilo · Pruna AI · Academia · Scenario |
| **3D** (`3d-model-generation/`) | Tripo AI · Meshy · Meta · Microsoft · Tencent · Deemos · Hitem3D · World Labs · Vast AI · YVO3D · Uthana · Cartwheel · Academia · Scenario |
| **Audio** (`audio-generation/`) | ElevenLabs · Google · Meta · Minimax · ByteDance · Beatoven · Sonilo · xAI · Academia · Scenario |
| **Upscale image** | Magnific · Topaz Labs · Recraft · Clarity AI · BFL · ByteDance · Phota · Pruna AI · Academia · Scenario |
| **Upscale vidéo** | Topaz Labs · Runway · Magnific · Clarity AI · ByteDance · Academia |
| **Détourage** | Photoroom · Pixa · Pixelcut · Bria · Ideogram · Academia |
| **Vectorisation** | Recraft · Vision Cortex · Academia |

## Les `jobType`, ou le catalogue d'outils

Les types de job de l'API sont directement les outils que le studio expose. Liste complète
telle que renvoyée par `reference/generate.run_model.md` :

```
assets-download · canvas-export · caption · caption-llava · custom · describe-style
detection · embed · flux · flux-model-training · generate-prompt · image-generation
image-prompt-editing · inference · mesh-preview-rendering · model-download · model-import
model-training · musubi-model-training · openai-image-generation · patch-image · pixelate
reframe · remove-background · repaint · restyle · segment · skybox-3d · skybox-base-360
skybox-hdri · skybox-upscale-360 · splat · texture · translate · upload
```

Correspondance avec les espaces du studio :

| Espace | `jobType` mobilisés |
|---|---|
| Image | `image-generation` · `flux` · `patch-image` · `repaint` · `restyle` · `segment` · `reframe` · `remove-background` · `pixelate` · `image-prompt-editing` |
| 3D | `mesh-preview-rendering` · `splat` · `texture` |
| Textures | `texture` · `describe-style` |
| Skyboxes | `skybox-3d` · `skybox-base-360` · `skybox-hdri` · `skybox-upscale-360` |
| Transverse | `caption` · `detection` · `embed` · `generate-prompt` · `translate` · `assets-download` |

## Limites connues de cette copie

- La spec OpenAPI (`cdn.cloud.scenario.com/static/api/swagger.yaml`) renvoie **403** : les
  schémas exacts des corps de requête viennent donc de `reference/` et, à l'exécution, de
  `GET /models/{modelId}`.
- Les corps de `POST /generate/custom/{modelId}` sont typés `unknown` dans le SDK.
  **C'est voulu côté Scenario** : le schéma est dynamique. Ne pas chercher à le figer.
- Aucune documentation publique sur les quotas de débit chiffrés. Traiter les 429 par
  backoff, sans supposer de seuil.
