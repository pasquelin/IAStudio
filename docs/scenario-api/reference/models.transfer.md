## Transfer

`client.models.transfer(stringmodelID, ModelTransferParamsparams, RequestOptionsoptions?): ModelTransferResponse`

**post** `/models/{modelId}/transfer`

Transfer (with a copy or a full ownership change) a model to a new owner, including all of its training images

### Parameters

- `modelID: string`

- `params: ModelTransferParams`

  - `destinationProjectId: string`

    Body param: The id of the project to copy and transfer the model to

  - `projectId?: string`

    Query param: The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

  - `destinationTeamId?: string`

    Body param: The id of the team to copy and transfer the model to

### Returns

- `ModelTransferResponse`

  - `model: Model`

    - `id: string`

      The model ID (example: "model_eyVcnFJcR92BxBkz7N6g5w")

    - `capabilities: Array<"3d23d" | "audio2audio" | "audio2txt" | 30 more>`

      List of model capabilities (example: ["txt2img", "img2img", "txt2img_ip_adapter", ...])

      - `"3d23d"`

      - `"audio2audio"`

      - `"audio2txt"`

      - `"audio2video"`

      - `"controlnet"`

      - `"controlnet_img2img"`

      - `"controlnet_inpaint"`

      - `"controlnet_inpaint_ip_adapter"`

      - `"controlnet_ip_adapter"`

      - `"controlnet_reference"`

      - `"controlnet_texture"`

      - `"img23d"`

      - `"img2img"`

      - `"img2img_ip_adapter"`

      - `"img2img_texture"`

      - `"img2txt"`

      - `"img2video"`

      - `"inpaint"`

      - `"inpaint_ip_adapter"`

      - `"outpaint"`

      - `"reference"`

      - `"reference_texture"`

      - `"txt23d"`

      - `"txt2audio"`

      - `"txt2img"`

      - `"txt2img_ip_adapter"`

      - `"txt2img_texture"`

      - `"txt2txt"`

      - `"txt2video"`

      - `"video23d"`

      - `"video2audio"`

      - `"video2img"`

      - `"video2video"`

    - `collectionIds: Array<string>`

      A list of CollectionId this model belongs to

    - `createdAt: string`

      The model creation date as an ISO string (example: "2023-02-03T11:19:41.579Z")

    - `custom: boolean`

      Whether the model is a custom model and can be used only with POST /generate/custom/{modelId} endpoint

    - `exampleAssetIds: Array<string>`

      List of all example asset IDs setup by the model owner

    - `privacy: "private" | "public" | "unlisted"`

      The privacy of the model (default: private)

      - `"private"`

      - `"public"`

      - `"unlisted"`

    - `source: "civitai" | "huggingface" | "other" | "scenario"`

      The source of the model

      - `"civitai"`

      - `"huggingface"`

      - `"other"`

      - `"scenario"`

    - `status: "copying" | "failed" | "new" | 3 more`

      The model status

      - `"copying"`

      - `"failed"`

      - `"new"`

      - `"trained"`

      - `"training"`

      - `"training-canceled"`

    - `tags: Array<string>`

      The associated tags (example: ["sci-fi", "landscape"])

    - `trainingImagesNumber: number`

      The total number of training images

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

    - `updatedAt: string`

      The model last update date as an ISO string (example: "2023-02-03T11:19:41.579Z")

    - `accessRestrictions?: 0 | 100 | 25 | 2 more`

      The access restrictions of the model
      0: Free plan
      25: Creator plan
      50: Pro plan
      75: Team plan
      100: Enterprise plan

      - `0`

      - `100`

      - `25`

      - `50`

      - `75`

    - `authorId?: string`

      The author user ID (example: "user_VFhihHKMRZyDDnZAJwLb2Q")

    - `class?: Class`

      The class of the model

      - `category: string`

        The category slug of the class (example: "art-style")

      - `conceptPrompt: string`

        The concept prompt of the class (example: "a sks character design")

      - `modelId: string`

        The model ID of the class. Only available for legacy models.

      - `name: string`

        The class name (example: "Character Design")

      - `prompt: string`

        The class prompt (example: "a character design")

      - `slug: string`

        The class slug (example: "art-style-character-design")

      - `status: "published" | "unpublished"`

        The class status (only published classes are listed, but unpublished classes can still appear in existing models)

        - `"published"`

        - `"unpublished"`

      - `thumbnails: Array<string>`

        Some example images URLs to showcase the class

    - `compliantModelIds?: Array<string>`

      List of base model IDs compliant with the model (example: ["flux.1-dev", "flux.1-schnell"])
      This attribute is mainly used for Flux LoRA models

    - `concepts?: Array<Concept>`

      The concepts is required for the type model: composition

      - `modelId: string`

        The model ID (example: "model_eyVcnFJcR92BxBkz7N6g5w")

      - `scale: number`

        The scale of the model (example: 1.0)
        For Flux Kontext Prompt Editing, the scale is between 0 and 2.

      - `modelEpoch?: string`

        The epoch of the model (example: "000001")
        Only available for Flux Lora Trained models

    - `disableRefund?: boolean`

      When true, credits spent on a generation with this model are not
      automatically refunded if the generation fails. Absent or false means
      failed generations are refunded as usual.

    - `epoch?: string`

      The epoch of the model. Only available for Flux Lora Trained models.
      If not set, uses the final model epoch (latest)

    - `epochs?: Array<Epoch>`

      The epochs of the model. Only available for Flux Lora Trained models.

      - `epoch: string`

        The epoch hash to identify the epoch

      - `assets?: Array<Asset>`

        The assets of the epoch if sample prompts as been supplied during training

        - `assetId: string`

          The AssetId of the image during training (example: "asset_GTrL3mq4SXWyMxkOHRxlpw")

        - `url: string`

          The url of the asset

    - `inputs?: Array<Input>`

      The inputs of the model. Only used for custom models. To retrieve this list, get it by modelId with GET /models/{modelId}

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

    - `modelKeyword?: string`

      The model keyword, this is a legacy parameter, please use conceptPrompt in parameters

    - `name?: string`

      The model name (example: "Cinematic Realism")

    - `negativePromptEmbedding?: string`

      Fine-tune the model's inferences with negative prompt embedding

    - `ownerId?: string`

      The owner ID (example: "team_VFhihHKMRZyDDnZAJwLb2Q")

    - `parameters?: Parameters`

      The parameters of the model

      - `age?: string`

        Age group of the voice (for professional cloning)

        Only available for ElevenLabs voice training

      - `batchSize?: number`

        The batch size
        Less steps, and will increase the learning rate

        Only available for Flux LoRA training

      - `classPrompt?: string`

        The prompt to specify images in the same class as provided instance images

        Deprecated legacy training parameter.

      - `cloneType?: string`

        Type of voice cloning: "instant" (fast) or "professional" (higher quality, requires captcha)

        Only available for ElevenLabs voice training

      - `conceptPrompt?: string`

        The prompt with identifier specifying the instance (or subject) of the class (example: "a daiton dog")

        Default value varies depending on the model type. For Flux LoRA, the default is an empty string.

      - `gender?: string`

        Gender of the voice (for professional cloning)

        Only available for ElevenLabs voice training

      - `language?: string`

        Language of the audio samples (ISO 639-1 code)

        Only available for ElevenLabs voice training

      - `learningRate?: number`

        Initial learning rate (after the potential warmup period)

        Default value varies depending on the model type. For Flux LoRA, the default is 0.0001.

      - `learningRateTextEncoder?: number`

        Initial learning rate (after the potential warmup period) for the text encoder

        Maximum [Flux LoRA: 0.001]
        Default [Flux LoRA: 0.00001]
        Minimum [Flux LoRA: 0.000001]

      - `learningRateUnet?: number`

        Initial learning rate (after the potential warmup period) for the UNet

        Deprecated legacy training parameter.

      - `lrScheduler?: "constant" | "constant-with-warmup" | "cosine" | 3 more`

        The scheduler type to use (default: "constant")

        Deprecated legacy training parameter.

        - `"constant"`

        - `"constant-with-warmup"`

        - `"cosine"`

        - `"cosine-with-restarts"`

        - `"linear"`

        - `"polynomial"`

      - `maxTrainSteps?: number`

        Maximum number of training steps to execute (default: varies depending on the model type)

        Default value varies depending on the model type:

        - For Flux: number of training images * 100

        Maximum value varies depending on the model type:

        - For Flux: [0, 10000]

      - `nbEpochs?: number`

        The number of epochs to train for

        Only available for Flux LoRA training

      - `nbRepeats?: number`

        The number of times to repeat the training

        Only available for Flux LoRA training

      - `numTextTrainSteps?: number`

        The number of training steps for the text encoder

        Deprecated legacy training parameter.

      - `numUNetTrainSteps?: number`

        The number of training steps for the UNet

        Deprecated legacy training parameter.

      - `optimizeFor?: "likeness"`

        Optimize the model training task for a specific type of input images. The available values are:

        - "likeness": optimize training for likeness or portrait (targets specific transformer blocks)
        - "all": train all transformer blocks
        - "none": train no specific transformer blocks

        This parameter controls which double and single transformer blocks are trained
        during the LoRA training process.

        Only available for Flux LoRA training

        - `"likeness"`

      - `priorLossWeight?: number`

        The weight of prior preservation loss

        Deprecated legacy training parameter.

      - `randomCrop?: boolean`

        Whether to random crop or center crop images before resizing to the working resolution

        Deprecated legacy training parameter.

      - `randomCropRatio?: number`

        Ratio of random crops

        Deprecated legacy training parameter.

      - `randomCropScale?: number`

        Scale of random crops

        Deprecated legacy training parameter.

      - `rank?: number`

        The dimension of the LoRA update matrices

        Only available for Flux LoRA and Musubi training

        Default value varies depending on the model type:

        - For Flux: 16
        - For Musubi: 64

        Each trainer enforces its own tighter limit (Flux LoRA: [2; 64], Musubi: [2; 128])

      - `removeBackgroundNoise?: boolean`

        Whether to remove background noise from audio samples before cloning.
        When enabled, each sample must be at least 5 seconds long.

        Only available for ElevenLabs voice training

      - `samplePrompts?: Array<string>`

        The prompts to use for each epoch
        Only available for Flux LoRA training

      - `sampleSourceImages?: Array<string>`

        The sample prompt images (AssetIds) paired with samplePrompts
        Only available for Flux LoRA training
        Must be the same length as samplePrompts

      - `scaleLr?: boolean`

        Whether to scale the learning rate

        Note: Legacy parameter, will be ignored

        Deprecated legacy training parameter.

      - `seed?: number`

        Used to reproduce previous results. Default: randomly generated number.

        Deprecated legacy training parameter.

      - `textEncoderTrainingRatio?: number`

        Whether to train the text encoder or not

        Example: For 100 steps and a value of 0.2, it means that the text encoder will be trained for 20 steps and then the UNet for 80 steps

        Note: Legacy parameter, please use `numTextTrainSteps` and `numUNetTrainSteps`

        Deprecated legacy training parameter.

      - `validationFrequency?: number`

        Validation frequency. Cannot be greater than maxTrainSteps value

        Deprecated legacy training parameter.

      - `validationPrompt?: string`

        Validation prompt

        Deprecated legacy training parameter.

      - `voiceDescription?: string`

        Description of the voice characteristics

        Only available for ElevenLabs voice training

      - `wandbKey?: string`

        The Weights And Bias key to use for logging. The maximum length is 40 characters

    - `parentModelId?: string`

      The id of the parent model

    - `performanceStats?: PerformanceStats`

      Aggregated performance stats

      - `variants: Array<Variant>`

        Performance metrics per variant

        - `capability: string`

          The generation capability (example: "txt2img", "img2video", "txt2audio")

        - `computedAt: string`

          When these stats were last computed (ISO date)

        - `variantKey: string`

          Unique variant identifier (example: "txt2img:1K", "img2video:2K", "txt2audio")

        - `arenaScore?: ArenaScore`

          External quality score from arena.ai leaderboard

          - `arenaCategory: string`

            Arena category (example: "text_to_image", "image_to_video")

          - `arenaModelName: string`

            Model name on arena.ai

          - `fetchedAt: string`

            When this score was last fetched (ISO date)

          - `rank: number`

            Rank in the arena category

          - `rating: number`

            ELO rating

          - `ratingLower: number`

            ELO rating confidence interval lower bound

          - `ratingUpper: number`

            ELO rating confidence interval upper bound

          - `votes: number`

            Number of human votes

        - `costPerAssetMaxCU?: number`

          Maximum cost per output asset (CU)

        - `costPerAssetMinCU?: number`

          Minimum cost per output asset (CU)

        - `costPerAssetP50CU?: number`

          Median cost per output asset (CU)

        - `inferenceLatencyP50Sec?: number`

          Inference latency P50 per output asset (seconds)

        - `inferenceLatencyP75Sec?: number`

          Inference latency P75 per output asset (seconds)

        - `resolution?: string`

          The resolution bucket (example: "0.5K", "1K", "2K", "4K")

        - `totalLatencyP50Sec?: number`

          Total latency P50 per output asset, including queue time (seconds)

        - `totalLatencyP75Sec?: number`

          Total latency P75 per output asset, including queue time (seconds)

      - `default?: string`

        Default variant key for quick model comparison

    - `promptEmbedding?: string`

      Fine-tune the model's inferences with prompt embedding

    - `shortDescription?: string`

      The model short description (example: "This model generates highly detailed cinematic scenes.")

    - `softDeletionOn?: string`

      The date when the model will be soft deleted (only for Free plan)

    - `thumbnail?: Thumbnail`

      A thumbnail for your model

      - `assetId: string`

        The AssetId of the image used as a thumbnail for your model (example: "asset_GTrL3mq4SXWyMxkOHRxlpw")

      - `url: string`

        The url of the image used as a thumbnail for your model

    - `trainingImagePairs?: Array<TrainingImagePair>`

      Array of training image pairs

      - `instruction?: string`

        The instruction for the image pair, source to target

      - `sourceId?: string`

        The source asset ID (must be a training asset)

      - `targetId?: string`

        The target asset ID (must be a training asset)

    - `trainingImages?: Array<TrainingImage>`

      The URLs of the first 3 training images of the model. To retrieve the full set of images, get it by modelId

      - `id: string`

        The training image ID (example: "asset_GTrL3mq4SXWyMxkOHRxlpw")

      - `automaticCaptioning: string`

        Automatic captioning of the image

      - `createdAt: string`

        The training image upload date as an ISO string (example: "2023-02-03T11:19:41.579Z")

      - `description: string`

        Description for the image

      - `downloadUrl: string`

        The URL of the image

      - `name: string`

        The original file name of the image (example: "my-training-image.jpg")

    - `trainingProgress?: TrainingProgress`

      Additional information about the training progress of the model

      - `stage: "pending" | "pending-captcha" | "queued-for-train" | 3 more`

        The stage of the request

        - `"pending"`

        - `"pending-captcha"`

        - `"queued-for-train"`

        - `"ready-for-captcha"`

        - `"running-train"`

        - `"starting-train"`

      - `updatedAt: number`

        Timestamp in milliseconds of the last time the training progress was updated

      - `captchaImageUrl?: string`

        Signed URL of the captcha image to read aloud during PVC voice cloning.
        Only present when stage === 'pending-captcha'. Overwritten on each retry.

      - `position?: number`

        Position of the job in the queue (ie. the number of job in the queue before this one)

      - `progress?: number`

        The progress of the job

      - `remainingTimeMs?: number`

        The remaining time in milliseconds

      - `retryableError?: string`

        Last recoverable failure message during PVC. Present when the model has
        bounced back to stage === 'ready-for-captcha' after a step 2 or step 3
        failure (e.g. captcha rejected, time limit exceeded). Surface above the
        retry button so the user understands why they're back here.

      - `retryCount?: number`

        Number of consecutive PVC step 2 / step 3 failures on this voice model.
        The model is marked Failed when this reaches the platform's max retries.

      - `startedAt?: number`

        The timestamp in millisecond marking the start of the process

    - `trainingStats?: TrainingStats`

      Additional information about the model's training

      - `endedAt?: string`

        The training end time as an ISO date string

      - `queueDuration?: number`

        The training queued duration in seconds

      - `startedAt?: string`

        The training start time as an ISO date string

      - `trainDuration?: number`

        The training duration in seconds

    - `uiConfig?: UiConfig`

      The UI configuration for the model

      - `inputProperties?: Record<string, InputProperties>`

        Configuration for the input properties

        - `collapsed?: boolean`

      - `lorasComponent?: LorasComponent`

        Configuration for the loras component

        - `label: string`

          The label of the component

        - `modelInput: string`

          The input name of the model (model_array)

        - `scaleInput: string`

          The input name of the scale (number_array)

        - `modelIdInput?: string`

          The input model id (example: a composition or a single LoRA modelId)
          If specified, the model id will be attached to the output asset as a metadata
          If the model-decomposer parser is specified on it, modelInput and scaleInput will be automatically populated

      - `presets?: Array<Preset>`

        Configuration for the presets

        - `fields: Array<string>`

        - `presets: unknown`

      - `resolutionComponent?: ResolutionComponent`

        Configuration for the resolution component

        - `heightInput: string`

          The input name of the height

        - `label: string`

          The label of the component

        - `presets: Array<Preset>`

          The resolution presets

          - `height: number`

          - `label: string`

          - `width: number`

        - `widthInput: string`

          The input name of the width

      - `selects?: Record<string, unknown>`

        Configuration for the selects

      - `triggerGenerate?: TriggerGenerate`

        Configuration for the trigger generate button

        - `label: string`

        - `after?: string`

          The 'name' of the input where the trigger generate button will be displayed (after the input).
          Do not specify both position and after.

        - `position?: "bottom" | "top"`

          The position of the trigger generate button. If position specified, the button will be displayed at the specified position.
          Do not specify both position and after.

          - `"bottom"`

          - `"top"`

    - `userId?: string`

      (Deprecated) The user ID (example: "user_VFhihHKMRZyDDnZAJwLb2Q")

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const response = await client.models.transfer('modelId', {
  destinationProjectId: 'destinationProjectId',
});

console.log(response.model);
```

#### Response

```json
{
  "model": {
    "id": "id",
    "capabilities": [
      "3d23d"
    ],
    "collectionIds": [
      "string"
    ],
    "createdAt": "createdAt",
    "custom": true,
    "exampleAssetIds": [
      "string"
    ],
    "privacy": "private",
    "source": "civitai",
    "status": "copying",
    "tags": [
      "string"
    ],
    "trainingImagesNumber": 0,
    "type": "custom",
    "updatedAt": "updatedAt",
    "accessRestrictions": 0,
    "authorId": "authorId",
    "class": {
      "category": "category",
      "conceptPrompt": "conceptPrompt",
      "modelId": "modelId",
      "name": "name",
      "prompt": "prompt",
      "slug": "slug",
      "status": "published",
      "thumbnails": [
        "string"
      ]
    },
    "compliantModelIds": [
      "string"
    ],
    "concepts": [
      {
        "modelId": "modelId",
        "scale": -2,
        "modelEpoch": "modelEpoch"
      }
    ],
    "disableRefund": true,
    "epoch": "epoch",
    "epochs": [
      {
        "epoch": "epoch",
        "assets": [
          {
            "assetId": "assetId",
            "url": "url"
          }
        ]
      }
    ],
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
        "required": {
          "always": true,
          "conditionalValues": {},
          "ifDefined": {},
          "ifNotDefined": {}
        },
        "step": 1
      }
    ],
    "modelKeyword": "modelKeyword",
    "name": "name",
    "negativePromptEmbedding": "negativePromptEmbedding",
    "ownerId": "ownerId",
    "parameters": {
      "age": "age",
      "batchSize": 1,
      "classPrompt": "classPrompt",
      "cloneType": "cloneType",
      "conceptPrompt": "conceptPrompt",
      "gender": "gender",
      "language": "language",
      "learningRate": 1,
      "learningRateTextEncoder": 0.0005,
      "learningRateUnet": 1,
      "lrScheduler": "constant",
      "maxTrainSteps": 0,
      "nbEpochs": 1,
      "nbRepeats": 1,
      "numTextTrainSteps": 0,
      "numUNetTrainSteps": 0,
      "optimizeFor": "likeness",
      "priorLossWeight": 1,
      "randomCrop": true,
      "randomCropRatio": 0,
      "randomCropScale": 0,
      "rank": 2,
      "removeBackgroundNoise": true,
      "samplePrompts": [
        "string"
      ],
      "sampleSourceImages": [
        "string"
      ],
      "scaleLr": true,
      "seed": 0,
      "textEncoderTrainingRatio": 0,
      "validationFrequency": 0,
      "validationPrompt": "validationPrompt",
      "voiceDescription": "voiceDescription",
      "wandbKey": "wandbKey"
    },
    "parentModelId": "parentModelId",
    "performanceStats": {
      "variants": [
        {
          "capability": "capability",
          "computedAt": "computedAt",
          "variantKey": "variantKey",
          "arenaScore": {
            "arenaCategory": "arenaCategory",
            "arenaModelName": "arenaModelName",
            "fetchedAt": "fetchedAt",
            "rank": 0,
            "rating": 0,
            "ratingLower": 0,
            "ratingUpper": 0,
            "votes": 0
          },
          "costPerAssetMaxCU": 0,
          "costPerAssetMinCU": 0,
          "costPerAssetP50CU": 0,
          "inferenceLatencyP50Sec": 0,
          "inferenceLatencyP75Sec": 0,
          "resolution": "resolution",
          "totalLatencyP50Sec": 0,
          "totalLatencyP75Sec": 0
        }
      ],
      "default": "default"
    },
    "promptEmbedding": "promptEmbedding",
    "shortDescription": "shortDescription",
    "softDeletionOn": "softDeletionOn",
    "thumbnail": {
      "assetId": "assetId",
      "url": "url"
    },
    "trainingImagePairs": [
      {
        "instruction": "instruction",
        "sourceId": "sourceId",
        "targetId": "targetId"
      }
    ],
    "trainingImages": [
      {
        "id": "id",
        "automaticCaptioning": "automaticCaptioning",
        "createdAt": "createdAt",
        "description": "description",
        "downloadUrl": "downloadUrl",
        "name": "name"
      }
    ],
    "trainingProgress": {
      "stage": "pending",
      "updatedAt": 0,
      "captchaImageUrl": "captchaImageUrl",
      "position": 0,
      "progress": 0,
      "remainingTimeMs": 0,
      "retryableError": "retryableError",
      "retryCount": 0,
      "startedAt": 0
    },
    "trainingStats": {
      "endedAt": "endedAt",
      "queueDuration": 0,
      "startedAt": "startedAt",
      "trainDuration": 0
    },
    "uiConfig": {
      "inputProperties": {
        "foo": {
          "collapsed": true
        }
      },
      "lorasComponent": {
        "label": "label",
        "modelInput": "modelInput",
        "scaleInput": "scaleInput",
        "modelIdInput": "modelIdInput"
      },
      "presets": [
        {
          "fields": [
            "string"
          ],
          "presets": {}
        }
      ],
      "resolutionComponent": {
        "heightInput": "heightInput",
        "label": "label",
        "presets": [
          {
            "height": 0,
            "label": "label",
            "width": 0
          }
        ],
        "widthInput": "widthInput"
      },
      "selects": {
        "foo": {}
      },
      "triggerGenerate": {
        "label": "label",
        "after": "after",
        "position": "bottom"
      }
    },
    "userId": "userId"
  }
}
```
