## Retrieve

`client.models.description.retrieve(stringmodelID, DescriptionRetrieveParamsquery?, RequestOptionsoptions?): DescriptionRetrieveResponse`

**get** `/models/{modelId}/description`

Get the description of the given `modelId`

### Parameters

- `modelID: string`

- `query: DescriptionRetrieveParams`

  - `originalAssets?: boolean`

    If set to true, returns the original asset without transformation

  - `projectId?: string`

    The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

### Returns

- `DescriptionRetrieveResponse`

  - `description: Description`

    - `assets: Array<Asset>`

      The list of assets referenced by the Markdown `{asset}` tag in the description.

      - `id: string`

        The asset ID (example: "asset_GTrL3mq4SXWyMxkOHRxlpw")

      - `authorId: string`

        The author user ID (example: "dcf121faaa1a0a0bbbd9ca1b73d62aea")

      - `kind: "3d" | "audio" | "document" | 5 more`

        The kind of asset

        - `"3d"`

        - `"audio"`

        - `"document"`

        - `"image"`

        - `"image-hdr"`

        - `"json"`

        - `"text"`

        - `"video"`

      - `mimeType: string`

        The mime type of the asset (example: "image/png")

      - `ownerId: string`

        The owner (project) ID (example: "proj_23tlk332lkht3kl2" or "team_dlkhgs23tlk3hlkth32lkht3kl2" for old teams)

      - `privacy: "private" | "public" | "unlisted"`

        The privacy of the asset

        - `"private"`

        - `"public"`

        - `"unlisted"`

      - `properties: Properties`

        The properties of the asset, content may depend on the kind of asset returned

        - `size: number`

        - `animationFrameCount?: number`

          Number of animation frames if animations exist

        - `bitrate?: number`

          Bitrate of the media in bits per second

        - `boneCount?: number`

          Number of bones if skeleton exists

        - `cameraMode?: "aerial" | "interior" | "turntable"`

          Recommended preview camera mode emitted by the generator (gsplat route);
          passed through to mesh-rendering verbatim.

          - `"aerial"`

          - `"interior"`

          - `"turntable"`

        - `cameraTrajectory?: Array<CameraTrajectory>`

          Recommended preview camera path emitted by the generator (gsplat route);
          passed through to mesh-rendering verbatim.

          - `position: Array<unknown>`

            Camera eye position in the splat's world frame.

          - `target: Array<unknown>`

            Look-at point in the splat's world frame.

          - `fov?: number`

            Vertical field of view in degrees (defaults to 50 in the renderer).

        - `channels?: number`

          Number of channels of the audio

        - `charCount?: number`

          Number of Unicode code points in the text. Code-point-aware (so a non-BMP
          emoji counts as 1) but not full grapheme-cluster aware (a ZWJ sequence
          still counts as several).

        - `classification?: "effect" | "interview" | "music" | 5 more`

          Classification of the audio

          - `"effect"`

          - `"interview"`

          - `"music"`

          - `"other"`

          - `"sound"`

          - `"speech"`

          - `"text"`

          - `"unknown"`

        - `codecName?: string`

          Codec name of the media

        - `description?: string`

          Description of the audio

        - `dimensions?: Array<number>`

          Bounding box dimensions [width, height, depth]

        - `duration?: number`

          Duration of the media in seconds

        - `faceCount?: number`

          Number of faces/triangles in the mesh

        - `format?: string`

          Format of the mesh file (e.g. 'glb', etc.)

        - `frameRate?: number`

          Frame rate of the video in frames per second

        - `hasAnimations?: boolean`

          Whether the mesh has animations

        - `hasFullPreview?: boolean`

          True when `preview` holds the entire content unmodified — consumers can
          use it directly without fetching `asset.url`. False or undefined means
          the content exceeds the preview budget and consumers must fetch the
          full body from S3 to read past the preview.

        - `hasNormals?: boolean`

          Whether the mesh has normal vectors

        - `hasSkeleton?: boolean`

          Whether the mesh has bones/skeleton

        - `hasUVs?: boolean`

          Whether the mesh has UV coordinates

        - `height?: number`

        - `nbFrames?: number`

          Number of frames in the video

        - `preview?: string`

          Leading slice of the content used for inline UI display and as a search
          shortcut. Capped at TEXT_PREVIEW_MAX_BYTES (UTF-8) and always cut on a
          code-point boundary so no character is split. Number of characters in the
          preview varies by script (around 1024 for ASCII, ~340 for CJK, ~256 for
          emoji-heavy text at the default 1 KB budget).

        - `sampleRate?: number`

          Sample rate of the media in Hz

        - `transcription?: Transcription`

          Transcription of the audio

          - `text: string`

        - `vertexCount?: number`

          Number of vertices in the mesh

        - `width?: number`

        - `wordCount?: number`

          Number of whitespace-separated words in the text

      - `source: "3d23d" | "3d23d:texture" | "3d:texture" | 77 more`

        source of the asset

        - `"3d23d"`

        - `"3d23d:texture"`

        - `"3d:texture"`

        - `"3d:texture:albedo"`

        - `"3d:texture:metallic"`

        - `"3d:texture:mtl"`

        - `"3d:texture:normal"`

        - `"3d:texture:roughness"`

        - `"audio2audio"`

        - `"audio2txt"`

        - `"audio2video"`

        - `"background-removal"`

        - `"canvas"`

        - `"canvas-drawing"`

        - `"canvas-export"`

        - `"detection"`

        - `"generative-fill"`

        - `"image-prompt-editing"`

        - `"img23d"`

        - `"img2img"`

        - `"img2splat"`

        - `"img2txt"`

        - `"img2video"`

        - `"inference-control-net"`

        - `"inference-control-net-img"`

        - `"inference-control-net-inpainting"`

        - `"inference-control-net-inpainting-ip-adapter"`

        - `"inference-control-net-ip-adapter"`

        - `"inference-control-net-reference"`

        - `"inference-control-net-texture"`

        - `"inference-img"`

        - `"inference-img-ip-adapter"`

        - `"inference-img-texture"`

        - `"inference-in-paint"`

        - `"inference-in-paint-ip-adapter"`

        - `"inference-reference"`

        - `"inference-reference-texture"`

        - `"inference-txt"`

        - `"inference-txt-ip-adapter"`

        - `"inference-txt-texture"`

        - `"patch"`

        - `"pixelization"`

        - `"reframe"`

        - `"restyle"`

        - `"segment"`

        - `"segmentation-image"`

        - `"segmentation-mask"`

        - `"skybox-3d"`

        - `"skybox-base-360"`

        - `"skybox-hdri"`

        - `"texture"`

        - `"texture:albedo"`

        - `"texture:ao"`

        - `"texture:edge"`

        - `"texture:height"`

        - `"texture:metallic"`

        - `"texture:normal"`

        - `"texture:smoothness"`

        - `"txt23d"`

        - `"txt2audio"`

        - `"txt2img"`

        - `"txt2txt"`

        - `"txt2video"`

        - `"unknown"`

        - `"uploaded"`

        - `"uploaded-3d"`

        - `"uploaded-audio"`

        - `"uploaded-avatar"`

        - `"uploaded-text"`

        - `"uploaded-video"`

        - `"upscale"`

        - `"upscale-skybox"`

        - `"upscale-texture"`

        - `"upscale-video"`

        - `"vectorization"`

        - `"video23d"`

        - `"video2audio"`

        - `"video2img"`

        - `"video2video"`

        - `"voice-clone"`

      - `url: string`

        Signed URL to get the asset content

      - `originalFileUrl?: string`

        The original file url.

        Contains the url of the original file. without any conversion. Only available for some specific video, audio and threeD assets.
        Is only specified if the given asset data has been replaced with a new file during the creation of the asset.

      - `preview?: Preview`

        The asset's preview.

        Contains the assetId and the url of the preview.

        - `assetId: string`

        - `url: string`

      - `thumbnail?: Thumbnail`

        The asset's thumbnail.

        Contains the assetId and the url of the thumbnail.

        - `assetId: string`

        - `url: string`

    - `models: Array<Model>`

      The list of models referenced by the Markdown `{model}` tag in the description.

      - `id: string`

        The model ID (example: "model_eyVcnFJcR92BxBkz7N6g5w")

      - `privacy: "private" | "public" | "unlisted"`

        The privacy of the model (default: private)

        - `"private"`

        - `"public"`

        - `"unlisted"`

      - `type: "custom" | "elevenlabs-voice" | "flux.1" | 28 more`

        The model type (example: "flux.1-lora")

        - `"custom"`

        - `"elevenlabs-voice"`

        - `"flux.1"`

        - `"flux.1-composition"`

        - `"flux.1-kontext-dev"`

        - `"flux.1-kontext-lora"`

        - `"flux.1-krea-dev"`

        - `"flux.1-krea-lora"`

        - `"flux.1-lora"`

        - `"flux.1-pro"`

        - `"flux.1.1-pro-ultra"`

        - `"flux.2-dev-edit-lora"`

        - `"flux.2-dev-lora"`

        - `"flux.2-klein-4b-edit-lora"`

        - `"flux.2-klein-4b-lora"`

        - `"flux.2-klein-9b-edit-lora"`

        - `"flux.2-klein-9b-lora"`

        - `"flux.2-klein-base-4b-edit-lora"`

        - `"flux.2-klein-base-4b-lora"`

        - `"flux.2-klein-base-9b-edit-lora"`

        - `"flux.2-klein-base-9b-lora"`

        - `"flux1.1-pro"`

        - `"gpt-image-1"`

        - `"qwen-image-2512-lora"`

        - `"qwen-image-edit-2509-lora"`

        - `"qwen-image-edit-2511-lora"`

        - `"qwen-image-edit-lora"`

        - `"qwen-image-lora"`

        - `"zimage-de-turbo-lora"`

        - `"zimage-lora"`

        - `"zimage-turbo-lora"`

      - `authorId?: string`

        The author user ID (example: "user_VFhihHKMRZyDDnZAJwLb2Q")

      - `name?: string`

        The model name (example: "Cinematic Realism")

      - `ownerId?: string`

        The owner ID (example: "team_VFhihHKMRZyDDnZAJwLb2Q")

      - `shortDescription?: string`

        The model short description (example: "This model generates highly detailed cinematic scenes.")

    - `value: string`

      The markdown description of the model (ex: `# My model`).
      We allow the `{asset:<assetId>}` and `{model:<modelId>}` tags.

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const description = await client.models.description.retrieve('modelId');

console.log(description.description);
```

#### Response

```json
{
  "description": {
    "assets": [
      {
        "id": "id",
        "authorId": "authorId",
        "kind": "3d",
        "mimeType": "mimeType",
        "ownerId": "ownerId",
        "privacy": "private",
        "properties": {
          "size": 0,
          "animationFrameCount": 0,
          "bitrate": 0,
          "boneCount": 0,
          "cameraMode": "aerial",
          "cameraTrajectory": [
            {
              "position": [
                {},
                {},
                {}
              ],
              "target": [
                {},
                {},
                {}
              ],
              "fov": 0
            }
          ],
          "channels": 0,
          "charCount": 0,
          "classification": "effect",
          "codecName": "codecName",
          "description": "description",
          "dimensions": [
            0,
            0,
            0
          ],
          "duration": 0,
          "faceCount": 0,
          "format": "format",
          "frameRate": 0,
          "hasAnimations": true,
          "hasFullPreview": true,
          "hasNormals": true,
          "hasSkeleton": true,
          "hasUVs": true,
          "height": 0,
          "nbFrames": 0,
          "preview": "preview",
          "sampleRate": 0,
          "transcription": {
            "text": "text"
          },
          "vertexCount": 0,
          "width": 0,
          "wordCount": 0
        },
        "source": "3d23d",
        "url": "url",
        "originalFileUrl": "originalFileUrl",
        "preview": {
          "assetId": "assetId",
          "url": "url"
        },
        "thumbnail": {
          "assetId": "assetId",
          "url": "url"
        }
      }
    ],
    "models": [
      {
        "id": "id",
        "privacy": "private",
        "type": "custom",
        "authorId": "authorId",
        "name": "name",
        "ownerId": "ownerId",
        "shortDescription": "shortDescription"
      }
    ],
    "value": "value"
  }
}
```
