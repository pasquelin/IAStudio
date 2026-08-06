## Patch

`client.generate.patch(GeneratePatchParamsparams, RequestOptionsoptions?): GeneratePatchResponse`

**post** `/generate/patch`

Patch an asset with an image.

### Parameters

- `params: GeneratePatchParams`

  - `image: string`

    Body param: The input image as a data URL (example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=") or the asset ID (example: "asset_GTrL3mq4SXWyMxkOHRxlpw")

  - `dryRun?: unknown`

    Query param

  - `originalAssets?: boolean`

    Query param: If set to true, returns the original asset without transformation

  - `projectId?: unknown`

    Query param

  - `allowOverflow?: boolean`

    Body param: Whether to allow the merged image to extend the size of the original (when x or y are negative or merged image is bigger)

  - `backgroundColor?: string`

    Body param: The background color as an hexadecimal code (ex: "#FFFFFF"), an html color (ex: "red") or "transparent" if "format" is "png". Default to "white"

  - `crop?: Crop`

    Body param: The crop operation to apply to the image. Applied before any operation. For the backgroundColor: rgba, hex or named color are supported.

    - `height: number`

    - `left: number`

    - `top: number`

    - `width: number`

    - `backgroundColor?: string`

  - `format?: "jpeg" | "png"`

    Body param: The output format. Default to "png"

    - `"jpeg"`

    - `"png"`

  - `patch?: Patch`

    Body param: The image to be merged.

    - `image: string`

      The source of the image to be merged, as a data URL (example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=") or the asset ID (example: "asset_GTrL3mq4SXWyMxkOHRxlpw")

    - `mode: "erase" | "override"`

      The mode of merging the images: `override` or `erase`.

      - `"erase"`

      - `"override"`

  - `position?: Position`

    Body param: The position of the image to be merged.

    - `x: number`

      The X position of the image to be merged, in pixels.

    - `y: number`

      The Y position of the image to be merged, in pixels.

### Returns

- `GeneratePatchResponse`

  - `job: Job`

    - `createdAt: string`

      The job creation date as an ISO string (example: "2023-02-03T11:19:41.579Z")

    - `jobId: string`

      The job ID (example: "job_ocZCnG1Df35XRL1QyCZSRxAG8")

    - `jobType: "assets-download" | "canvas-export" | "caption" | 37 more`

      The type of job

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

      Metadata of the job with some additional information

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

    - `progress: number`

      Progress of the job (between 0 and 1)

    - `status: "canceled" | "failure" | "finalizing" | 5 more`

      The current status of the job

      - `"canceled"`

      - `"failure"`

      - `"finalizing"`

      - `"in-progress"`

      - `"pending"`

      - `"queued"`

      - `"success"`

      - `"warming-up"`

    - `statusHistory: Array<StatusHistory>`

      The history of the different statuses the job went through with the ISO string date
      of when the job reached each statuses.

      - `date: string`

      - `status: "canceled" | "failure" | "finalizing" | 5 more`

        - `"canceled"`

        - `"failure"`

        - `"finalizing"`

        - `"in-progress"`

        - `"pending"`

        - `"queued"`

        - `"success"`

        - `"warming-up"`

    - `updatedAt: string`

      The job last update date as an ISO string (example: "2023-02-03T11:19:41.579Z")

    - `authorId?: string`

      The author user ID (example: "dcf121faaa1a0a0bbbd9ca1b73d62aea")

    - `billing?: Billing`

      The billing of the job

      - `cuCost: number`

      - `cuDiscount: number`

      - `disableRefund?: boolean`

        When true, the credits charged for this job are not automatically
        refunded if the generation fails, because the model used does not
        support refund-on-failure. Absent or false means a failed generation is
        refunded as usual.

    - `ownerId?: string`

      The owner ID (example: "team_U3Qmc8PCdWXwAQJ4Dvw4tV6D")

  - `asset?: Asset`

    - `id: string`

      The asset ID (example: "asset_GTrL3mq4SXWyMxkOHRxlpw")

    - `authorId: string`

      The author user ID (example: "dcf121faaa1a0a0bbbd9ca1b73d62aea")

    - `collectionIds: Array<string>`

      A list of CollectionId this asset belongs to

    - `createdAt: string`

      The asset creation date as an ISO string (example: "2023-02-03T11:19:41.579Z")

    - `editCapabilities: Array<"DETECTION" | "GENERATIVE_FILL" | "PIXELATE" | 8 more>`

      List of edit capabilities

      - `"DETECTION"`

      - `"GENERATIVE_FILL"`

      - `"PIXELATE"`

      - `"PROMPT_EDITING"`

      - `"REFINE"`

      - `"REFRAME"`

      - `"REMOVE_BACKGROUND"`

      - `"SEGMENTATION"`

      - `"UPSCALE"`

      - `"UPSCALE_360"`

      - `"VECTORIZATION"`

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

    - `metadata: Metadata`

      Metadata of the asset with some additional information

      - `kind: "3d" | "audio" | "document" | 5 more`

        - `"3d"`

        - `"audio"`

        - `"document"`

        - `"image"`

        - `"image-hdr"`

        - `"json"`

        - `"text"`

        - `"video"`

      - `type: "3d-texture" | "3d-texture-albedo" | "3d-texture-metallic" | 77 more`

        The type of the asset. Ex: 'inference-txt2img' will represent an asset generated from a text to image model

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

      - `angular?: number`

        How angular is the surface? 0 is like a sphere, 1 is like a mechanical object

      - `aspectRatio?: string`

        The optional aspect ratio given for the generation, only applicable for some models

      - `backgroundOpacity?: number`

      - `baseModelId?: string`

        The baseModelId that maybe changed at inference time

      - `bbox?: Array<number>`

        A bounding box around the object of interest, in the format [x1, y1, x2, y2].

      - `betterQuality?: boolean`

      - `cannyStructureImage?: string`

        The control image already processed by canny detector. Must reference an existing AssetId.

      - `clustering?: boolean`

        Activate clustering.

      - `colorCorrection?: boolean`

        Ensure upscaled tile have the same color histogram as original tile.

      - `colorMode?: string`

      - `colorPrecision?: number`

      - `concepts?: Array<Concept>`

        Flux Kontext LoRA to style the image.
        For Flux Kontext Prompt Editing.

        - `modelId: string`

          The model ID (example: "model_eyVcnFJcR92BxBkz7N6g5w")

        - `scale: number`

          The scale of the model (example: 1.0)
          For Flux Kontext Prompt Editing, the scale is between 0 and 2.

        - `modelEpoch?: string`

          The epoch of the model (example: "000001")
          Only available for Flux Lora Trained models

      - `contours?: Array<Array<Array<Array<number>>>>`

      - `controlEnd?: number`

        End step for control.

      - `copiedAt?: string`

        The date when the asset was copied to a project

      - `cornerThreshold?: number`

      - `creativity?: number`

        Allow the generation of "hallucinations" during the upscale process, which adds additional details and deviates from the original image. Default: optimized for your preset and style.

      - `creativityDecay?: number`

        Amount of decay in creativity over the upscale process. The lowest the value, the less the creativity will be preserved over the upscale process.

      - `defaultParameters?: boolean`

        If true, use the default parameters

      - `depthFidelity?: number`

        The depth fidelity if a depth image provided

      - `depthImage?: string`

        The control image processed by depth estimator. Must reference an existing AssetId.

      - `detailsLevel?: number`

        Amount of details to remove or add

      - `dilate?: number`

      - `factor?: number`

        Contrast factor for Grayscale detector

      - `filterSpeckle?: number`

      - `fractality?: number`

        Determine the scale at which the upscale process works.

        - With a small value, the upscale works at the largest scale, resulting in fewer added details and more coherent images. Ideal for portraits, for example.
        - With a large value, the upscale works at the smallest scale, resulting in more added details and more hallucinations. Ideal for landscapes, for example.

        (info): A small value is slower and more expensive to run.

      - `geometryEnforcement?: number`

        Apply extra control to the Skybox 360 geometry.
        The higher the value, the more the 360 geometry will influence the generated skybox image.

        Use with caution. Default is adapted to the other parameters.

      - `guidance?: number`

        The guidance used to generate this asset

      - `halfMode?: boolean`

      - `hdr?: number`

      - `height?: number`

      - `highThreshold?: number`

        High threshold for Canny detector

      - `horizontalExpansionRatio?: number`

        (deprecated) Horizontal expansion ratio.

      - `image?: string`

        The input image to process. Must reference an existing AssetId or be a data URL.

      - `imageFidelity?: number`

        Strengthen the similarity to the original image during the upscale. Default: optimized for your preset and style.

      - `imageType?: "seamfull" | "skybox" | "texture"`

        Preserve the seamless properties of skybox or texture images. Input has to be of same type (seamless).

        - `"seamfull"`

        - `"skybox"`

        - `"texture"`

      - `inferenceId?: string`

        The id of the Inference describing how this image was generated

      - `inputFidelity?: "high" | "low"`

        When set to `high`, allows to better preserve details from the input images in the output.
        This is especially useful when using images that contain elements like faces or logos that
        require accurate preservation in the generated image.

        You can provide multiple input images that will all be preserved with high fidelity, but keep
        in mind that the first image will be preserved with richer textures and finer details, so if
        you include elements such as faces, consider placing them in the first image.

        Only available for the `gpt-image-1` model.

        - `"high"`

        - `"low"`

      - `inputLocation?: "bottom" | "left" | "middle" | 2 more`

        Location of the input image in the output.

        - `"bottom"`

        - `"left"`

        - `"middle"`

        - `"right"`

        - `"top"`

      - `invert?: boolean`

        To invert the relief

      - `keypointThreshold?: number`

        How polished is the surface? 0 is like a rough surface, 1 is like a mirror

      - `layerDifference?: number`

      - `lengthThreshold?: number`

      - `lockExpiresAt?: string`

        The ISO timestamp when the lock on the canvas will expire

      - `lowThreshold?: number`

        Low threshold for Canny detector

      - `mask?: string`

        The mask used for the asset generation or editing

      - `maxIterations?: number`

      - `maxThreshold?: number`

        Maximum threshold for Grayscale conversion

      - `minThreshold?: number`

        Minimum threshold for Grayscale conversion

      - `modality?: "canny" | "depth" | "grayscale" | 7 more`

        Modality to detect

        - `"canny"`

        - `"depth"`

        - `"grayscale"`

        - `"lineart_anime"`

        - `"mlsd"`

        - `"normal"`

        - `"pose"`

        - `"scribble"`

        - `"segmentation"`

        - `"sketch"`

      - `mode?: string`

      - `modelId?: string`

        The modelId used to generate this asset

      - `modelType?: "custom" | "elevenlabs-voice" | "flux.1" | 28 more`

        The type of the generator used

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

      - `name?: string`

      - `nbMasks?: number`

      - `negativePrompt?: string`

        The negative prompt used to generate this asset

      - `negativePromptStrength?: number`

        Controls the influence of the negative prompt. Default 0 means the negative prompt has no effect. Higher values increase negative prompt influence.
        Must be > 0 if negativePrompt is provided.

      - `numInferenceSteps?: number`

        The number of denoising steps for each image generation.

      - `numOutputs?: number`

        The number of outputs to generate.

      - `originalAssetId?: string`

      - `outputIndex?: number`

      - `overlapPercentage?: number`

        Overlap percentage for the output image.

      - `overrideEmbeddings?: boolean`

        Override the embeddings of the model. Only your prompt and negativePrompt will be used. Use with caution.

      - `parentId?: string`

      - `parentJobId?: string`

      - `pathPrecision?: number`

      - `points?: Array<Array<number>>`

        List of points (label, x, y) in the image where label = 0 for background and 1 for object.

      - `polished?: number`

        How polished is the surface? 0 is like a rough surface, 1 is like a mirror

      - `preset?: string`

      - `progressPercent?: number`

      - `prompt?: string`

        The prompt that guided the asset generation or editing

      - `promptFidelity?: number`

        Increase the fidelity to the prompt during upscale. Default: optimized for your preset and style.

      - `raised?: number`

        How raised is the surface? 0 is flat like water, 1 is like a very rough rock

      - `referenceImages?: Array<string>`

        The reference images used for the asset generation or editing

      - `refinementSteps?: number`

        Additional refinement steps before scaling.

        If scalingFactor == 1, the refinement process will be applied (1 + refinementSteps) times.
        If scalingFactor > 1, the refinement process will be applied refinementSteps times.

      - `removeBackground?: boolean`

        Remove background for Grayscale detector

      - `resizeOption?: number`

        Size proportion of the input image in the output.

      - `resultContours?: boolean`

        Boolean to output the contours.

      - `resultImage?: boolean`

        Boolean to return the source image with the mask applied as alpha channel
        (RGBA PNG, transparent background) instead of the binary mask.
        Mutually exclusive with `resultMask` — passing both as `true` returns a 400 error.
        Note: `backgroundOpacity` is no longer honored — alpha is binary (0/255) only.

      - `resultMask?: boolean`

        Boolean to return the binary masks in the response.
        Mutually exclusive with `resultImage` — passing both as `true` returns a 400 error.

      - `rootParentId?: string`

      - `saveFlipbook?: boolean`

        Save a flipbook of the texture. Deactivated when the input texture is larger than 2048x2048px

      - `scalingFactor?: number`

        Scaling factor (when `targetWidth` not specified)

      - `scheduler?: string`

        The scheduler used to generate this asset

      - `seed?: string`

        The seed used to generate this asset. <!> Can be a string or a number in some cases <!>.

      - `sharpen?: boolean`

        Sharpen tiles.

      - `shiny?: number`

        How shiny is the surface? 0 is like a matte surface, 1 is like a diamond

      - `size?: number`

      - `sketch?: boolean`

        Activate sketch detection instead of canny.

      - `sourceProjectId?: string`

      - `spliceThreshold?: number`

      - `strength?: number`

        The strength

        Only available for the `flux-kontext` LoRA model.

      - `structureFidelity?: number`

        Strength for the input image structure preservation

      - `structureImage?: string`

        The control image for structure. A canny detector will be applied to this image. Must reference an existing AssetId.

      - `style?: "3d-cartoon" | "3d-rendered" | "anime" | 23 more`

        - `"3d-cartoon"`

        - `"3d-rendered"`

        - `"anime"`

        - `"cartoon"`

        - `"cinematic"`

        - `"claymation"`

        - `"cloud-skydome"`

        - `"comic"`

        - `"cyberpunk"`

        - `"enchanted"`

        - `"fantasy"`

        - `"ink"`

        - `"manga"`

        - `"manga-color"`

        - `"minimalist"`

        - `"neon-tron"`

        - `"oil-painting"`

        - `"pastel"`

        - `"photo"`

        - `"photography"`

        - `"psychedelic"`

        - `"retro-fantasy"`

        - `"scifi-concept-art"`

        - `"space"`

        - `"standard"`

        - `"whimsical"`

      - `styleFidelity?: number`

        The higher the value the more it will look like the style image(s)

      - `styleImages?: Array<string>`

        List of style images. Most of the time, only one image is enough. It must be existing AssetIds.

      - `styleImagesFidelity?: number`

        Condition the influence of the style image(s). The higher the value, the more the style images will influence the upscaled image.

      - `targetHeight?: number`

        The target height of the output image.

      - `targetWidth?: number`

        Target width for the upscaled image, take priority over scaling factor

      - `text?: string`

        A textual description / keywords describing the object of interest.

      - `texture?: string`

        The asset to convert in texture maps. Must reference an existing AssetId.

      - `thumbnail?: Thumbnail`

        The thumbnail of the canvas

        - `assetId: string`

          The AssetId of the image used as a thumbnail for the canvas (example: "asset_GTrL3mq4SXWyMxkOHRxlpw")

        - `url: string`

          The url of the image used as a thumbnail for the canvas

      - `tileStyle?: boolean`

        If set to true, during the upscaling process, the model will match tiles of the source image with tiles of the style image(s). This will result in a more coherent restyle. Works best with style images that have a similar composition.

      - `trainingImage?: boolean`

      - `verticalExpansionRatio?: number`

        (deprecated) Vertical expansion ratio.

      - `width?: number`

        The width of the rendered image.

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

    - `status: "error" | "pending" | "success"`

      The actual status

      - `"error"`

      - `"pending"`

      - `"success"`

    - `tags: Array<string>`

      The associated tags (example: ["sci-fi", "landscape"])

    - `updatedAt: string`

      The asset last update date as an ISO string (example: "2023-02-03T11:19:41.579Z")

    - `url: string`

      Signed URL to get the asset content

    - `automaticCaptioning?: string`

      Automatic captioning of the asset

    - `description?: string`

      The description, it will contain in priority:

      - the manual description
      - the advanced captioning when the asset is used in training flow
      - the automatic captioning

    - `embedding?: Array<number>`

      The embedding of the asset when requested.

      Only available when an asset can be embedded (ie: not Detection maps)

    - `firstFrame?: FirstFrame`

      The video asset's first frame.

      Contains the assetId and the url of the first frame.

      - `assetId: string`

      - `url: string`

    - `isHidden?: boolean`

      Whether the asset is hidden.

    - `lastFrame?: LastFrame`

      The video asset's last frame.

      Contains the assetId and the url of the last frame.

      - `assetId: string`

      - `url: string`

    - `nsfw?: Array<string>`

      The NSFW labels

    - `originalFileUrl?: string`

      The original file url.

      Contains the url of the original file. without any conversion. Only available for some specific video, audio and threeD assets.
      Is only specified if the given asset data has been replaced with a new file during the creation of the asset.

    - `outputIndex?: number`

      The output index of the asset within a job
      This index is an positive integer that starts at 0
      It is used to differentiate between multiple outputs of the same job
      If the job has only one output, this index is 0

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

  - `creativeUnitsCost?: number`

    The Compute Units cost for the request billed

  - `creativeUnitsDiscount?: number`

    The Compute Units discount for the request billed

  - `ipDetection?: IPDetection`

    IP detection findings, when detection ran for this request.

    - `action: "allowed" | "blocked" | "flagged"`

      Whether and how detection affected the request.

      - `"allowed"`

      - `"blocked"`

      - `"flagged"`

    - `creativeUnitsCharged: number`

      IP-detection CU fee, separate from creativeUnitsCost: a fixed base fee
      plus a per-image fee for each analyzed input image.

    - `evaluatedFilters: number`

      Number of enabled filters evaluated for this request.

    - `findings: Array<Finding>`

      Per-filter verdicts gathered for this request.

      - `category: "artist-style" | "brand-trademark" | "celebrity-likeness" | 2 more`

        Category of the filter that produced this verdict.

        - `"artist-style"`

        - `"brand-trademark"`

        - `"celebrity-likeness"`

        - `"custom"`

        - `"fictional-character"`

      - `confidence: number`

        Confidence score from 0 (low) to 1 (high).

      - `filterId: string`

        Identifier of the filter that produced this verdict.

      - `filterName: string`

        Display name of the filter that produced this verdict.

      - `flagged: boolean`

        Whether this filter considered the request an IP risk.

      - `reason: string`

        Short, user-facing explanation of the verdict.

      - `entities?: Array<string>`

        Named entities the filter recognized (e.g. characters, brands, people).

    - `flagged: boolean`

      Convenience flag; always true when action is not 'allowed'.

    - `hasDetectorError?: boolean`

      True if one or more detectors errored while evaluating this request.

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const response = await client.generate.patch({ image: 'image' });

console.log(response.job);
```

#### Response

```json
{
  "job": {
    "createdAt": "createdAt",
    "jobId": "jobId",
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
    "progress": 0,
    "status": "canceled",
    "statusHistory": [
      {
        "date": "date",
        "status": "canceled"
      }
    ],
    "updatedAt": "updatedAt",
    "authorId": "authorId",
    "billing": {
      "cuCost": 0,
      "cuDiscount": 0,
      "disableRefund": true
    },
    "ownerId": "ownerId"
  },
  "asset": {
    "id": "id",
    "authorId": "authorId",
    "collectionIds": [
      "string"
    ],
    "createdAt": "createdAt",
    "editCapabilities": [
      "DETECTION"
    ],
    "kind": "3d",
    "metadata": {
      "kind": "3d",
      "type": "3d-texture",
      "angular": 0,
      "aspectRatio": "aspectRatio",
      "backgroundOpacity": 0,
      "baseModelId": "baseModelId",
      "bbox": [
        0,
        0,
        0,
        0
      ],
      "betterQuality": true,
      "cannyStructureImage": "cannyStructureImage",
      "clustering": true,
      "colorCorrection": true,
      "colorMode": "colorMode",
      "colorPrecision": 0,
      "concepts": [
        {
          "modelId": "modelId",
          "scale": -2,
          "modelEpoch": "modelEpoch"
        }
      ],
      "contours": [
        [
          [
            [
              0
            ]
          ]
        ]
      ],
      "controlEnd": 0,
      "copiedAt": "copiedAt",
      "cornerThreshold": 0,
      "creativity": 0,
      "creativityDecay": 0,
      "defaultParameters": true,
      "depthFidelity": 0,
      "depthImage": "depthImage",
      "detailsLevel": -50,
      "dilate": 0,
      "factor": 0,
      "filterSpeckle": 0,
      "fractality": 0,
      "geometryEnforcement": 0,
      "guidance": 0,
      "halfMode": true,
      "hdr": 0,
      "height": 0,
      "highThreshold": 0,
      "horizontalExpansionRatio": 1,
      "image": "image",
      "imageFidelity": 0,
      "imageType": "seamfull",
      "inferenceId": "inferenceId",
      "inputFidelity": "high",
      "inputLocation": "bottom",
      "invert": true,
      "keypointThreshold": 0,
      "layerDifference": 0,
      "lengthThreshold": 0,
      "lockExpiresAt": "lockExpiresAt",
      "lowThreshold": 0,
      "mask": "mask",
      "maxIterations": 0,
      "maxThreshold": 0,
      "minThreshold": 0,
      "modality": "canny",
      "mode": "mode",
      "modelId": "modelId",
      "modelType": "custom",
      "name": "name",
      "nbMasks": 0,
      "negativePrompt": "negativePrompt",
      "negativePromptStrength": 0,
      "numInferenceSteps": 5,
      "numOutputs": 1,
      "originalAssetId": "originalAssetId",
      "outputIndex": 0,
      "overlapPercentage": 0,
      "overrideEmbeddings": true,
      "parentId": "parentId",
      "parentJobId": "parentJobId",
      "pathPrecision": 0,
      "points": [
        [
          0
        ],
        [
          0
        ],
        [
          0
        ]
      ],
      "polished": 0,
      "preset": "preset",
      "progressPercent": 0,
      "prompt": "prompt",
      "promptFidelity": 0,
      "raised": 0,
      "referenceImages": [
        "string"
      ],
      "refinementSteps": 0,
      "removeBackground": true,
      "resizeOption": 0.1,
      "resultContours": true,
      "resultImage": true,
      "resultMask": true,
      "rootParentId": "rootParentId",
      "saveFlipbook": true,
      "scalingFactor": 1,
      "scheduler": "scheduler",
      "seed": "seed",
      "sharpen": true,
      "shiny": 0,
      "size": 0,
      "sketch": true,
      "sourceProjectId": "sourceProjectId",
      "spliceThreshold": 0,
      "strength": 0,
      "structureFidelity": 0,
      "structureImage": "structureImage",
      "style": "3d-cartoon",
      "styleFidelity": 0,
      "styleImages": [
        "string"
      ],
      "styleImagesFidelity": 0,
      "targetHeight": 0,
      "targetWidth": 1024,
      "text": "text",
      "texture": "texture",
      "thumbnail": {
        "assetId": "assetId",
        "url": "url"
      },
      "tileStyle": true,
      "trainingImage": true,
      "verticalExpansionRatio": 1,
      "width": 1024
    },
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
    "status": "error",
    "tags": [
      "string"
    ],
    "updatedAt": "updatedAt",
    "url": "url",
    "automaticCaptioning": "automaticCaptioning",
    "description": "description",
    "embedding": [
      0
    ],
    "firstFrame": {
      "assetId": "assetId",
      "url": "url"
    },
    "isHidden": true,
    "lastFrame": {
      "assetId": "assetId",
      "url": "url"
    },
    "nsfw": [
      "string"
    ],
    "originalFileUrl": "originalFileUrl",
    "outputIndex": 0,
    "preview": {
      "assetId": "assetId",
      "url": "url"
    },
    "thumbnail": {
      "assetId": "assetId",
      "url": "url"
    }
  },
  "creativeUnitsCost": 0,
  "creativeUnitsDiscount": 0,
  "ipDetection": {
    "action": "allowed",
    "creativeUnitsCharged": 0,
    "evaluatedFilters": 0,
    "findings": [
      {
        "category": "artist-style",
        "confidence": 0,
        "filterId": "filterId",
        "filterName": "filterName",
        "flagged": true,
        "reason": "reason",
        "entities": [
          "string"
        ]
      }
    ],
    "flagged": true,
    "hasDetectorError": true
  }
}
```
