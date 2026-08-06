## List

`client.usages.list(UsageListParamsquery?, RequestOptionsoptions?): UsageListResponse`

**get** `/usages`

Provide usage data for the given filters. Such as consumed compute units, number of assets generated, etc. Maximum time range with custom startDate and endDate is 120 days. Granularity is calculated based on the time range.

### Parameters

- `query: UsageListParams`

  - `activityOffset?: number`

    The offset for the activity data. Default is 0. If bad offset or empty, 0 will be returned. Must be a positive integer.

  - `dropZeroPoints?: boolean`

    When set, points whose numeric fields are all zero are removed from `usages`, `modelUsages`, `assetUsages` and `nsfwUsages`. The parent entry (model, kind, label, usageName) is preserved with `points: []` so callers still see every row. Useful on wide windows × fine granularities × many models, where the zero-fill can push the response past the 6 MB API Gateway sync limit. The bare `?dropZeroPoints` form, plus any value (`true`, `1`, `yes`, `on`, …) enables it; absent or explicit falsy literals (`false`, `0`, `no`, `off`) disable it. Default disabled for backwards compatibility.

  - `endDate?: string`

    The end date of the usage in ISO 8601 format. If not provided, use default timeRange. If provided, startDate is required.

  - `projectIds?: string`

    The project ids for filtering the usage data. If not provided, use all projects. Can be one or more comma separated values.

  - `startDate?: string`

    The start date of the usage in ISO 8601 format. If not provided, use default timeRange. If provided, endDate is required.

  - `teamId?: string`

    The teamId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

  - `timeRange?: "last-hour" | "last-day" | "last-three-days" | 2 more`

    The time range of the usage. If not provided, use default timeRange. If startDate and endDate provided, timeRange is ignored.

    - `"last-hour"`

    - `"last-day"`

    - `"last-three-days"`

    - `"last-seven-days"`

    - `"last-thirty-one-days"`

  - `type?: Array<"usages" | "activity" | "consumption" | 3 more>`

    The type of the usage data. Can be one or more comma separated values. Can be any of the following values: usages, activity, consumption, model-usages, asset-usages, nsfw-usages. Default is all types. If bad type or empty, all types will be returned.

    - `"usages"`

    - `"activity"`

    - `"consumption"`

    - `"model-usages"`

    - `"asset-usages"`

    - `"nsfw-usages"`

  - `userId?: string`

    The unique identifier of the user for the usage. If not provided, returns all usages for the team.

  - `userIds?: string`

    The unique identifiers of the users for filtering the usage data. If not provided, use all users. Can be one or more comma separated values.

### Returns

- `UsageListResponse`

  - `activity?: Array<Activity>`

    - `action: "asset" | "asset-privacy" | "assistant-message" | 96 more`

      The action name

      - `"asset"`

      - `"asset-privacy"`

      - `"assistant-message"`

      - `"background-removal"`

      - `"byok-remove-project-provider"`

      - `"byok-remove-provider"`

      - `"byok-set-project-provider"`

      - `"byok-set-provider"`

      - `"captioning"`

      - `"collection"`

      - `"collection-assets"`

      - `"collection-models"`

      - `"controlnet"`

      - `"controlnet-img2img"`

      - `"controlnet-inpaint"`

      - `"controlnet-ip-adapter"`

      - `"controlnet-texture"`

      - `"copy-asset"`

      - `"copy-model"`

      - `"creative-unit-cost"`

      - `"creative-unit-discount"`

      - `"custom"`

      - `"custom-asset-created"`

      - `"delete-asset"`

      - `"delete-collection"`

      - `"delete-collection-assets"`

      - `"delete-collection-models"`

      - `"delete-inference-image"`

      - `"delete-model"`

      - `"delete-model-preset"`

      - `"delete-oscu-auto-refill"`

      - `"delete-project-member"`

      - `"delete-subscription"`

      - `"delete-team-api-key"`

      - `"delete-team-invitations"`

      - `"delete-team-member"`

      - `"delete-training-images"`

      - `"describe-style"`

      - `"detection"`

      - `"disable-project-model"`

      - `"disable-team-model"`

      - `"download-assets"`

      - `"download-model"`

      - `"embed"`

      - `"enable-project-model"`

      - `"enable-team-model"`

      - `"generative-fill"`

      - `"image-prompt-editing"`

      - `"images-generation"`

      - `"img2img"`

      - `"img2img-ip-adapter"`

      - `"img2img-texture"`

      - `"inference"`

      - `"inpaint"`

      - `"inpaint-ip-adapter"`

      - `"ip-detection"`

      - `"model"`

      - `"model-preset"`

      - `"models-training"`

      - `"oscu"`

      - `"patch"`

      - `"pixelate"`

      - `"project"`

      - `"project-member"`

      - `"reframe"`

      - `"refunds"`

      - `"repaint"`

      - `"restyle"`

      - `"segmentation"`

      - `"skybox-base-360"`

      - `"skybox-upscale-360"`

      - `"start-train"`

      - `"subscription"`

      - `"subscription-seats"`

      - `"tag-asset"`

      - `"tag-model"`

      - `"team-api-key"`

      - `"team-member"`

      - `"texture"`

      - `"train-succeeded"`

      - `"training-images-to-model"`

      - `"transfer-model"`

      - `"txt2img"`

      - `"txt2img-ip-adapter"`

      - `"update-asset"`

      - `"update-collection"`

      - `"update-model"`

      - `"update-model-description"`

      - `"update-model-examples"`

      - `"update-model-prompt-guide"`

      - `"update-oscu-auto-refill"`

      - `"update-project"`

      - `"update-project-instructions"`

      - `"update-subscription"`

      - `"update-team"`

      - `"update-team-instructions"`

      - `"update-team-member"`

      - `"upscale"`

      - `"vectorization"`

    - `data: Data`

      The additional data of the action

      - `assetId?: string`

        The asset for this action

      - `byokProvider?: ByokProvider`

        The BYOK provider information for this action
        Only set if the action is a BYOK action (byok-set-provider or byok-remove-provider)

        - `id: string`

        - `displayName: string`

      - `collectionId?: string`

        The collection for this action

      - `isApiKey?: boolean`

        Whether the action is an API key action

      - `jobId?: string`

        The job for this action

      - `modelId?: string`

        The model for this action

    - `projectId: string`

      The projectId of the project for this action

    - `time: string`

      The UTC ISO date of the point

    - `userId: string`

      The unique identifier of the user for this action

    - `creativeUnitsCost?: number`

      The Compute Units cost for this action

  - `assetUsages?: Array<AssetUsage>`

    - `kind: "3d" | "audio" | "document" | 5 more`

      - `"3d"`

      - `"audio"`

      - `"document"`

      - `"image"`

      - `"image-hdr"`

      - `"json"`

      - `"text"`

      - `"video"`

    - `points: Array<Point>`

      The data points

      - `count: number`

        Number of assets created

      - `countApiKey: number`

        Number of assets created via an API key

      - `time: string`

        The UTC ISO date of the point

  - `consumption?: Array<Consumption>`

    - `discount: number`

      The Compute Units discount for the user

    - `total: number`

      The total consumption for the user (value + discount)

    - `userId: string`

      The unique identifier of the user

    - `value: number`

      The Compute Units consumption for the user

  - `entities?: Entities`

    - `assets?: Array<Asset>`

      - `id: string`

        The asset ID

      - `kind: "3d" | "audio" | "document" | 5 more`

        The kind of the asset

        - `"3d"`

        - `"audio"`

        - `"document"`

        - `"image"`

        - `"image-hdr"`

        - `"json"`

        - `"text"`

        - `"video"`

      - `metadata: Metadata`

        Partial metadata of the asset

        - `type: "3d-texture" | "3d-texture-albedo" | "3d-texture-metallic" | 77 more`

          The type of the asset

          - `"3d-texture"`

          - `"3d-texture-albedo"`

          - `"3d-texture-metallic"`

          - `"3d-texture-mtl"`

          - `"3d-texture-normal"`

          - `"3d-texture-roughness"`

          - `"3d23d"`

          - `"3d23d-texture"`

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

          - `"inference-controlnet"`

          - `"inference-controlnet-img2img"`

          - `"inference-controlnet-inpaint"`

          - `"inference-controlnet-inpaint-ip-adapter"`

          - `"inference-controlnet-ip-adapter"`

          - `"inference-controlnet-reference"`

          - `"inference-controlnet-texture"`

          - `"inference-img2img"`

          - `"inference-img2img-ip-adapter"`

          - `"inference-img2img-texture"`

          - `"inference-inpaint"`

          - `"inference-inpaint-ip-adapter"`

          - `"inference-reference"`

          - `"inference-reference-texture"`

          - `"inference-txt2img"`

          - `"inference-txt2img-ip-adapter"`

          - `"inference-txt2img-texture"`

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

          - `"texture-albedo"`

          - `"texture-ao"`

          - `"texture-edge"`

          - `"texture-height"`

          - `"texture-metallic"`

          - `"texture-normal"`

          - `"texture-smoothness"`

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

      - `properties: Properties`

        The properties of the asset

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

        The source of the asset

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

    - `collections?: Array<Collection>`

      - `id: string`

        The collection ID

      - `name: string`

        The name of the collection

    - `jobs?: Array<Job>`

      - `id: string`

        The job ID

      - `jobType: "assets-download" | "canvas-export" | "caption" | 37 more`

        The job type

        - `"assets-download"`

        - `"canvas-export"`

        - `"caption"`

        - `"caption-llava"`

        - `"custom"`

        - `"describe-style"`

        - `"detection"`

        - `"embed"`

        - `"flux"`

        - `"flux-model-training"`

        - `"generate-prompt"`

        - `"image-generation"`

        - `"image-prompt-editing"`

        - `"inference"`

        - `"mesh-preview-rendering"`

        - `"model-download"`

        - `"model-import"`

        - `"model-training"`

        - `"musubi-model-training"`

        - `"openai-image-generation"`

        - `"patch-image"`

        - `"pixelate"`

        - `"reframe"`

        - `"remove-background"`

        - `"repaint"`

        - `"restyle"`

        - `"segment"`

        - `"skybox-3d"`

        - `"skybox-base-360"`

        - `"skybox-hdri"`

        - `"skybox-upscale-360"`

        - `"splat"`

        - `"texture"`

        - `"translate"`

        - `"upload"`

        - `"upscale"`

        - `"upscale-skybox"`

        - `"upscale-texture"`

        - `"vectorize"`

        - `"workflow"`

      - `metadata: Metadata`

        The metadata of the job

        - `assetIds?: Array<string>`

          List of produced assets for this job

        - `error?: string | null`

          Eventual error for the job

        - `flow?: Array<Flow>`

          The flow of the job. Only available for workflow jobs.

          - `id: string`

            The id of the node.

          - `status: "failure" | "pending" | "processing" | 3 more`

            The status of the node. Only available for WorkflowJob nodes.

            - `"failure"`

            - `"pending"`

            - `"processing"`

            - `"rejected"`

            - `"skipped"`

            - `"success"`

          - `type: "custom-model" | "for-each" | "generate-prompt" | 7 more`

            The type of the job for the node.

            - `"custom-model"`

            - `"for-each"`

            - `"generate-prompt"`

            - `"list"`

            - `"logic"`

            - `"model"`

            - `"remove-background"`

            - `"transform"`

            - `"user-approval"`

            - `"workflow"`

          - `assets?: Array<Asset>`

            List of produced assets for this node.

            - `assetId: string`

            - `url: string`

          - `count?: number`

            Fixed number of iterations for a ForEach node.
            When set, the loop runs exactly `count` times regardless of array input.
            When not set, the loop iterates over the resolved array input.
            Only available for ForEach nodes.

          - `dependsOn?: Array<string>`

            The nodes that this node depends on.
            Only available for nodes that have dependencies. Mainly used for user approval nodes.

          - `includeOutputsInWorkflowJob?: true`

            If true, the outputs of this node will be included in the workflow job's final output.
            Only applicable to producing nodes (custom-model, inference, etc.).
            By default, only last nodes (nodes not referenced by other nodes) contribute to outputs.
            Set this to true to also include intermediate nodes in the final output.
            Note: This should only be set to `true` or left undefined.

            - `true`

          - `inputs?: Array<Input>`

            The inputs of the node.

            - `name: string`

              The name that must be user to call the model through the API

            - `type: "boolean" | "file" | "file_array" | 7 more`

              The data type of the input

              - `"boolean"`

              - `"file"`

              - `"file_array"`

              - `"inputs_array"`

              - `"model"`

              - `"model_array"`

              - `"number"`

              - `"number_array"`

              - `"string"`

              - `"string_array"`

            - `allowedValues?: Array<unknown>`

              The allowed values for the input. For `string` or `number` types, creates a single-select
              dropdown.
              For `string_array` type, creates a multi-select dropdown.

            - `backgroundBehavior?: "opaque" | "transparent"`

              Specifies the background behavior for the input. Only available for `file` and `file_array`
              input types with kind `image`.

              - `"opaque"`

              - `"transparent"`

            - `color?: boolean`

              Whether the input is a color or not. Only available for `string` input type.

            - `costImpact?: boolean`

              Whether this input affects the model's cost calculation

            - `default?: unknown`

              The default value for the input

            - `description?: string`

              Help text displayed in the UI to provide additional information about the input

            - `group?: string`

              Used to visually group inputs together in the UI. Inputs with the same group value appear
              consecutively in the UI.

            - `hint?: string`

              Hint text displayed in the UI as a tooltip to guide the user

            - `inputs?: Array<Record<string, unknown>>`

              The list of inputs which form an object within a container array.
              All inputs are the same as the current object.
              This is only available for type inputs_array inputs.

            - `items?: Array<Array<Item>>`

              The configured items for inputs_array type inputs.
              Each item is an array of SubNodeInput that need ref/value resolution.
              Only available for inputs_array type.

              - `name: string`

                The name that must be user to call the model through the API

              - `type: "boolean" | "file" | "file_array" | 7 more`

                The data type of the input

                - `"boolean"`

                - `"file"`

                - `"file_array"`

                - `"inputs_array"`

                - `"model"`

                - `"model_array"`

                - `"number"`

                - `"number_array"`

                - `"string"`

                - `"string_array"`

              - `allowedValues?: Array<unknown>`

                The allowed values for the input. For `string` or `number` types, creates a single-select
                dropdown.
                For `string_array` type, creates a multi-select dropdown.

              - `backgroundBehavior?: "opaque" | "transparent"`

                Specifies the background behavior for the input. Only available for `file` and `file_array`
                input types with kind `image`.

                - `"opaque"`

                - `"transparent"`

              - `color?: boolean`

                Whether the input is a color or not. Only available for `string` input type.

              - `costImpact?: boolean`

                Whether this input affects the model's cost calculation

              - `default?: unknown`

                The default value for the input

              - `description?: string`

                Help text displayed in the UI to provide additional information about the input

              - `group?: string`

                Used to visually group inputs together in the UI. Inputs with the same group value appear
                consecutively in the UI.

              - `hint?: string`

                Hint text displayed in the UI as a tooltip to guide the user

              - `inputs?: Array<Record<string, unknown>>`

                The list of inputs which form an object within a container array.
                All inputs are the same as the current object.
                This is only available for type inputs_array inputs.

              - `kind?: "3d" | "audio" | "document" | 5 more`

                The asset kind of the input. Only taken into account for `file` and `file_array` input types.
                If model provides multiple kinds,
                the input will be not able to create the asset on the flight on API side with dataurl without data:kind, prefix

                - `"3d"`

                - `"audio"`

                - `"document"`

                - `"image"`

                - `"image-hdr"`

                - `"json"`

                - `"text"`

                - `"video"`

              - `label?: string`

                The label displayed in the UI for this input

              - `maskFrom?: string`

                The name of the file input field to use as the mask source

              - `max?: number`

                The maximum allowed value. Only available for `number` and `array` input types.

              - `maxDuration?: number`

                The maximum allowed media duration in seconds. Only applies to `file` and `file_array` input types
                for video and audio assets. Validated against `asset.properties.duration` at job creation time.

              - `maxLength?: number`

                The maximum allowed length for `string` inputs. Also applies to each item in `string_array`.

              - `maxSize?: number`

                The maximum allowed file size in bytes. Only applies to `file` and `file_array` input types.
                Validated against `asset.properties.size` at job creation time.

              - `min?: number`

                The minimum allowed value. Only available for `number` and array input types.

              - `minLength?: number`

                The minimum allowed length for string inputs. Also applies to each item in `string_array`.

              - `modelTypes?: Array<"custom" | "elevenlabs-voice" | "flux.1" | 28 more>`

                The allowed model types for this input. Example: `["flux.1-lora"]`.
                Only available for `model_array` input type.

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

              - `parent?: boolean`

                Whether this input represents a parent asset to assign to the produced assets.
                Only available for `file` and `file_array` input types.

                For `file_array`, the parent asset is the first item in the array.

              - `placeholder?: string`

                Placeholder text for the input. Only available for 'string' input type.

              - `prompt?: boolean`

                Whether the input is a prompt. When true, displays as a text area with prompt spark feature.
                Only available for `string` input type.

              - `promptSpark?: boolean`

                Whether the input is used with prompt spark. Only available for `string` input type.

              - `ref?: Ref`

                The reference to another input or output of the same workflow.
                Must have at least one of node or conditional.

                - `conditional?: Array<string>`

                  The conditional nodes to reference.
                  If the conditional nodes are successful, the node will be successful.
                  If the conditional nodes are skipped, the node will be skipped.
                  Contains an array of node ids used to check the status of the nodes.

                - `equal?: string`

                  This is the desired node output value if ref is an if/else node.

                - `name?: string`

                  The name of the input or output to reference.
                  If the type is 'workflow', the name is the name of the input of the workflow is required
                  If the type is 'node', the name is not mandatory, except if you want all outputs of the node.
                  To get all outputs of a node, you can use the name 'all'.

                - `node?: string`

                  The node id or 'workflow' if the source is a workflow input.

              - `required?: Required`

                Set of rules that describes when this input is required:

                - `always`: Input is always required
                - `ifNotDefined`: Input is required when another specified input is not defined
                - `ifDefined`: Input is required when another specified input is defined
                - `conditionalValues`: Input is required when another input has a specific value

                By default, the input is not required.

                - `always?: boolean`

                  Whether the input is always required

                - `conditionalValues?: unknown`

                  Makes this input required when another input has a specific value:

                  - Key: name of the input to check
                  - Value: operation and allowed values that trigger the requirement

                - `ifDefined?: unknown`

                  Makes this input required when another input is defined:

                  - Key: name of the input that must be defined
                  - Value: message to display when this input is required

                - `ifNotDefined?: unknown`

                  Makes this input required when another input is not defined:

                  - Key: name of the input that must be undefined
                  - Value: message to display when this input is required

              - `step?: number`

                The step increment for numeric inputs. Only available for `number` input type.

              - `value?: unknown`

                The value of the input.
                This is the value of the input that will be used to run the node.
                Only available for flows managed by a WorkflowJob.

            - `kind?: "3d" | "audio" | "document" | 5 more`

              The asset kind of the input. Only taken into account for `file` and `file_array` input types.
              If model provides multiple kinds,
              the input will be not able to create the asset on the flight on API side with dataurl without data:kind, prefix

              - `"3d"`

              - `"audio"`

              - `"document"`

              - `"image"`

              - `"image-hdr"`

              - `"json"`

              - `"text"`

              - `"video"`

            - `label?: string`

              The label displayed in the UI for this input

            - `maskFrom?: string`

              The name of the file input field to use as the mask source

            - `max?: number`

              The maximum allowed value. Only available for `number` and `array` input types.

            - `maxDuration?: number`

              The maximum allowed media duration in seconds. Only applies to `file` and `file_array` input types
              for video and audio assets. Validated against `asset.properties.duration` at job creation time.

            - `maxLength?: number`

              The maximum allowed length for `string` inputs. Also applies to each item in `string_array`.

            - `maxSize?: number`

              The maximum allowed file size in bytes. Only applies to `file` and `file_array` input types.
              Validated against `asset.properties.size` at job creation time.

            - `min?: number`

              The minimum allowed value. Only available for `number` and array input types.

            - `minLength?: number`

              The minimum allowed length for string inputs. Also applies to each item in `string_array`.

            - `modelTypes?: Array<"custom" | "elevenlabs-voice" | "flux.1" | 28 more>`

              The allowed model types for this input. Example: `["flux.1-lora"]`.
              Only available for `model_array` input type.

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

            - `parent?: boolean`

              Whether this input represents a parent asset to assign to the produced assets.
              Only available for `file` and `file_array` input types.

              For `file_array`, the parent asset is the first item in the array.

            - `placeholder?: string`

              Placeholder text for the input. Only available for 'string' input type.

            - `prompt?: boolean`

              Whether the input is a prompt. When true, displays as a text area with prompt spark feature.
              Only available for `string` input type.

            - `promptSpark?: boolean`

              Whether the input is used with prompt spark. Only available for `string` input type.

            - `ref?: Ref`

              The reference to another input or output of the same workflow.
              Must have at least one of node or conditional.

              - `conditional?: Array<string>`

                The conditional nodes to reference.
                If the conditional nodes are successful, the node will be successful.
                If the conditional nodes are skipped, the node will be skipped.
                Contains an array of node ids used to check the status of the nodes.

              - `equal?: string`

                This is the desired node output value if ref is an if/else node.

              - `name?: string`

                The name of the input or output to reference.
                If the type is 'workflow', the name is the name of the input of the workflow is required
                If the type is 'node', the name is not mandatory, except if you want all outputs of the node.
                To get all outputs of a node, you can use the name 'all'.

              - `node?: string`

                The node id or 'workflow' if the source is a workflow input.

            - `required?: Required`

              Set of rules that describes when this input is required:

              - `always`: Input is always required
              - `ifNotDefined`: Input is required when another specified input is not defined
              - `ifDefined`: Input is required when another specified input is defined
              - `conditionalValues`: Input is required when another input has a specific value

              By default, the input is not required.

              - `always?: boolean`

                Whether the input is always required

              - `conditionalValues?: unknown`

                Makes this input required when another input has a specific value:

                - Key: name of the input to check
                - Value: operation and allowed values that trigger the requirement

              - `ifDefined?: unknown`

                Makes this input required when another input is defined:

                - Key: name of the input that must be defined
                - Value: message to display when this input is required

              - `ifNotDefined?: unknown`

                Makes this input required when another input is not defined:

                - Key: name of the input that must be undefined
                - Value: message to display when this input is required

            - `step?: number`

              The step increment for numeric inputs. Only available for `number` input type.

            - `value?: unknown`

              The value of the input.
              This is the value of the input that will be used to run the node.
              Only available for flows managed by a WorkflowJob.

          - `items?: Array<string>`

            Statically-configured items for a List node.
            The node outputs this array as-is when executed.
            Only available for List nodes.
            The values can be strings, numbers, or asset IDs.

          - `iterationIndex?: number`

            Zero-based index of the iteration this node copy belongs to.
            Set on dynamically-created copies of loop body nodes.

          - `jobId?: string`

            If the flow is part of a WorkflowJob, this is the jobId for the node.
            jobId is only available for nodes started. A node "Pending" for a running workflow job is not started.

          - `logic?: Logic`

            The logic of the node.
            Only available for logic nodes.

            - `cases?: Array<Case>`

              The cases of the logic.
              Only available for if/else nodes.

              - `condition: string`

              - `value: string`

            - `default?: string`

              The default case of the logic.
              Contains the id/output of the node to execute if no case is matched.
              Only available for if/else nodes.

            - `transform?: string`

              The transform of the logic.
              Only available for transform nodes.

          - `logicType?: "if-else"`

            The type of the logic for the node.
            Only available for logic nodes.

            - `"if-else"`

          - `loopBodyNodeIds?: Array<string>`

            IDs of the body template nodes that belong to this ForEach loop.
            At runtime these templates are cloned once per iteration and marked Skipped.
            Only available for ForEach nodes.

          - `loopNodeId?: string`

            ID of the ForEach node that spawned this iteration copy.
            Set on dynamically-created copies of loop body nodes.

          - `modelId?: string`

            The model id for the node. Mainly used for custom model tasks.

          - `output?: unknown`

            The output of the node.
            Only available for logic nodes.

          - `workflowId?: string`

            The workflow id for the node. Mainly used for workflow tasks.

        - `hint?: string`

          Actionable hint for the user explaining what went wrong and how to resolve it.

        - `input?: Record<string, unknown>`

          The inputs for the job

        - `output?: Record<string, unknown>`

          May contain the output of the job for specific custom models jobs.
          Only available for custom models which generate non-assets outputs.
          Example: LLM text results.

        - `outputModelId?: string`

          For voice-clone jobs: the ID of the model being trained.

        - `workflowId?: string`

          The workflow ID of the job if job is part of a workflow.

        - `workflowJobId?: string`

          The workflow job ID of the job if job is part of a workflow job.

      - `status: "canceled" | "failure" | "finalizing" | 5 more`

        The status of the job

        - `"canceled"`

        - `"failure"`

        - `"finalizing"`

        - `"in-progress"`

        - `"pending"`

        - `"queued"`

        - `"success"`

        - `"warming-up"`

    - `models?: Array<Model>`

      - `id: string`

        The model ID

      - `name: string`

        The name of the model

      - `shortDescription?: string`

        The short description of the model

    - `users?: Array<User>`

      - `id: string`

        The user ID

      - `isApiKey: boolean`

        Whether the user is an API key

      - `apiKeyId?: string`

        The API key ID

        Will be available:

        - if the user is an API key

      - `apiKeyStatus?: "active" | "deleted" | "inactive"`

        The API key status

        Will be available:

        - if the user is an API key

        - `"active"`

        - `"deleted"`

        - `"inactive"`

      - `avatar?: Avatar`

        The user avatar

        Will be available:

        - if the user hasn't left the Scenario platform
        - if the user isn't an API key

        - `assetId?: string`

          ID of the asset used as thumbnail if provided, otherwise undefined

        - `url?: string`

          Signed URL of the assetId or free url if assetId is undefined

      - `email?: string`

        The email of the user

        Will be available:

        - if the user hasn't left the Scenario platform
        - if the user isn't an API key

      - `fullName?: string`

        The full name of the user

        Will be available:

        - if the user hasn't left the Scenario platform
        - if the user isn't an API key

  - `modelUsages?: Array<ModelUsage>`

    - `modelId: string`

    - `points: Array<Point>`

      The data points

      - `apiKeyCost: number`

        Cost for model usage for API key only

      - `apiKeyDiscount: number`

        The discount for model usage for API key only

      - `cost: number`

        Cost for model usage

      - `discount: number`

        The discount for model usage

      - `jobs: number`

        Number of jobs for the model usage

      - `time: string`

        The UTC ISO date of the point

  - `nsfwUsages?: Array<NsfwUsage>`

    - `label: string`

    - `points: Array<Point>`

      The data points

      - `count: number`

        Number of NSFW assets created

      - `countApiKey: number`

        Number of NSFW assets created via an API key

      - `time: string`

        The UTC ISO date of the point

  - `usages?: Array<Usage>`

    - `granularity: "15m" | "1d" | "1h" | 4 more`

      Granularity for points (example: "1d", "1h", "1m", "15m")

      - `"15m"`

      - `"1d"`

      - `"1h"`

      - `"1m"`

      - `"30m"`

      - `"5m"`

      - `"7d"`

    - `points: Array<Point>`

      The usage data points

      - `apiKey: string`

        Value of the point for API key only

      - `time: string`

        The UTC ISO date of the point

      - `value: string`

        Value of the point

      - `apiKeyCost?: number`

        Cost in Compute Units for the point restricted to API-key calls
        (mirrors the `apiKey` value field but on the cost axis).

      - `apiKeyDiscount?: number`

        Discount in Compute Units for the point restricted to API-key calls.

      - `cost?: number`

        Cost in Compute Units for the point.
        Only populated for usage actions that carry a CU cost (generations,
        trainings, etc.). Free actions like `delete-asset` or `tag-asset`
        will report `0`.

      - `discount?: number`

        Discount applied in Compute Units for the point. Only populated for usage actions that carry a CU
        discount.

    - `usageName: "background-removal" | "captioning" | "creative-unit-cost" | 19 more`

      Name of the usage points (example: "images-generation", "generators-training", "background-removal", "upscale", ...)

      - `"background-removal"`

      - `"captioning"`

      - `"creative-unit-cost"`

      - `"creative-unit-discount"`

      - `"custom"`

      - `"custom-asset-created"`

      - `"detection"`

      - `"image-prompt-editing"`

      - `"images-generation"`

      - `"ip-detection"`

      - `"models-training"`

      - `"patch"`

      - `"pixelate"`

      - `"refunds"`

      - `"repaint"`

      - `"restyle"`

      - `"segmentation"`

      - `"skybox-base-360"`

      - `"skybox-upscale-360"`

      - `"texture"`

      - `"upscale"`

      - `"vectorization"`

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const usages = await client.usages.list();

console.log(usages.activity);
```

#### Response

```json
{
  "activity": [
    {
      "action": "asset",
      "data": {
        "assetId": "assetId",
        "byokProvider": {
          "id": "id",
          "displayName": "displayName"
        },
        "collectionId": "collectionId",
        "isApiKey": true,
        "jobId": "jobId",
        "modelId": "modelId"
      },
      "projectId": "projectId",
      "time": "time",
      "userId": "userId",
      "creativeUnitsCost": 0
    }
  ],
  "assetUsages": [
    {
      "kind": "3d",
      "points": [
        {
          "count": 0,
          "countApiKey": 0,
          "time": "time"
        }
      ]
    }
  ],
  "consumption": [
    {
      "discount": 0,
      "total": 0,
      "userId": "userId",
      "value": 0
    }
  ],
  "entities": {
    "assets": [
      {
        "id": "id",
        "kind": "3d",
        "metadata": {
          "type": "3d-texture"
        },
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
        "source": "3d23d"
      }
    ],
    "collections": [
      {
        "id": "id",
        "name": "name"
      }
    ],
    "jobs": [
      {
        "id": "id",
        "jobType": "assets-download",
        "metadata": {
          "assetIds": [
            "string"
          ],
          "error": "error",
          "flow": [
            {
              "id": "id",
              "status": "failure",
              "type": "custom-model",
              "assets": [
                {
                  "assetId": "assetId",
                  "url": "url"
                }
              ],
              "count": 0,
              "dependsOn": [
                "string"
              ],
              "includeOutputsInWorkflowJob": true,
              "inputs": [
                {
                  "name": "name",
                  "type": "boolean",
                  "allowedValues": [
                    {}
                  ],
                  "backgroundBehavior": "opaque",
                  "color": true,
                  "costImpact": true,
                  "default": {},
                  "description": "description",
                  "group": "group",
                  "hint": "hint",
                  "inputs": [
                    {
                      "foo": "bar"
                    }
                  ],
                  "items": [
                    [
                      {
                        "name": "name",
                        "type": "boolean",
                        "allowedValues": [
                          {}
                        ],
                        "backgroundBehavior": "opaque",
                        "color": true,
                        "costImpact": true,
                        "default": {},
                        "description": "description",
                        "group": "group",
                        "hint": "hint",
                        "inputs": [
                          {
                            "foo": "bar"
                          }
                        ],
                        "kind": "3d",
                        "label": "label",
                        "maskFrom": "maskFrom",
                        "max": 0,
                        "maxDuration": 0,
                        "maxLength": 0,
                        "maxSize": 0,
                        "min": 0,
                        "minLength": 0,
                        "modelTypes": [
                          "custom"
                        ],
                        "parent": true,
                        "placeholder": "placeholder",
                        "prompt": true,
                        "promptSpark": true,
                        "ref": {
                          "conditional": [
                            "string"
                          ],
                          "equal": "equal",
                          "name": "name",
                          "node": "node"
                        },
                        "required": {
                          "always": true,
                          "conditionalValues": {},
                          "ifDefined": {},
                          "ifNotDefined": {}
                        },
                        "step": 1,
                        "value": {}
                      }
                    ]
                  ],
                  "kind": "3d",
                  "label": "label",
                  "maskFrom": "maskFrom",
                  "max": 0,
                  "maxDuration": 0,
                  "maxLength": 0,
                  "maxSize": 0,
                  "min": 0,
                  "minLength": 0,
                  "modelTypes": [
                    "custom"
                  ],
                  "parent": true,
                  "placeholder": "placeholder",
                  "prompt": true,
                  "promptSpark": true,
                  "ref": {
                    "conditional": [
                      "string"
                    ],
                    "equal": "equal",
                    "name": "name",
                    "node": "node"
                  },
                  "required": {
                    "always": true,
                    "conditionalValues": {},
                    "ifDefined": {},
                    "ifNotDefined": {}
                  },
                  "step": 1,
                  "value": {}
                }
              ],
              "items": [
                "string"
              ],
              "iterationIndex": 0,
              "jobId": "jobId",
              "logic": {
                "cases": [
                  {
                    "condition": "condition",
                    "value": "value"
                  }
                ],
                "default": "default",
                "transform": "transform"
              },
              "logicType": "if-else",
              "loopBodyNodeIds": [
                "string"
              ],
              "loopNodeId": "loopNodeId",
              "modelId": "modelId",
              "output": {},
              "workflowId": "workflowId"
            }
          ],
          "hint": "hint",
          "input": {
            "foo": "bar"
          },
          "output": {
            "foo": "bar"
          },
          "outputModelId": "outputModelId",
          "workflowId": "workflowId",
          "workflowJobId": "workflowJobId"
        },
        "status": "canceled"
      }
    ],
    "models": [
      {
        "id": "id",
        "name": "name",
        "shortDescription": "shortDescription"
      }
    ],
    "users": [
      {
        "id": "id",
        "isApiKey": true,
        "apiKeyId": "apiKeyId",
        "apiKeyStatus": "active",
        "avatar": {
          "assetId": "assetId",
          "url": "url"
        },
        "email": "email",
        "fullName": "fullName"
      }
    ]
  },
  "modelUsages": [
    {
      "modelId": "modelId",
      "points": [
        {
          "apiKeyCost": 0,
          "apiKeyDiscount": 0,
          "cost": 0,
          "discount": 0,
          "jobs": 0,
          "time": "time"
        }
      ]
    }
  ],
  "nsfwUsages": [
    {
      "label": "label",
      "points": [
        {
          "count": 0,
          "countApiKey": 0,
          "time": "time"
        }
      ]
    }
  ],
  "usages": [
    {
      "granularity": "15m",
      "points": [
        {
          "apiKey": "apiKey",
          "time": "time",
          "value": "value",
          "apiKeyCost": 0,
          "apiKeyDiscount": 0,
          "cost": 0,
          "discount": 0
        }
      ],
      "usageName": "background-removal"
    }
  ]
}
```
