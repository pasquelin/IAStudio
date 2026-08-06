## Caption

`client.generate.caption(GenerateCaptionParamsparams, RequestOptionsoptions?): GenerateCaptionResponse`

**post** `/generate/caption`

Caption image(s)

### Parameters

- `params: GenerateCaptionParams`

  - `images: Array<string>`

    Body param: List of images used to generate captions. Results are returned in the same order as the given
    images.

    Images are set a data URLs (example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=") or the asset IDs (example: "asset_GTrL3mq4SXWyMxkOHRxlpw").

    Notes:

    - if both `modelId` and `images` are provided, `modelId`'s examples and training images will be
      used to influence the caption structure of the images
    - if only `images` are provided, the captions will be conditioned by the `detailsLevel` parameter
    - Replaces `assetIds` parameter
    - if you want to caption multiple images at a time, please prefer using asset ids instead of data url

  - `dryRun?: unknown`

    Query param

  - `projectId?: unknown`

    Query param

  - `assetIds?: Array<string>`

    Body param: The assetIds to generate captions. Results are returned in the same order as the given
    assetIds. Deprecated, use `images` parameter instead.

  - `detailsLevel?: "action" | "action+style"`

    Body param: The details level used to generate the captions.

    When a modelId is provided and examples are available, the details level is ignored.

    - `"action"`

    - `"action+style"`

  - `ensureIPCleared?: boolean`

    Body param: Whether we try to ensure IP removal for new prompt generation.

  - `modelId?: string`

    Body param: When provided, the model will follow the model's training images and examples' prompt to generate the captions.

  - `seed?: number`

    Body param: If specified, the API will make a best effort to produce the same results, such that repeated requests with the same `seed` and parameters should return the same outputs. Must be used along with the same parameters including prompt, model's state, etc..

  - `temperature?: number`

    Body param: The sampling temperature to use. Higher values like `0.8` will make the output more random, while lower values like `0.2` will make it more focused and deterministic.

    We generally recommend altering this or `topP` but not both.

  - `topP?: number`

    Body param: An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So `0.1` means only the tokens comprising the top `10%` probability mass are considered.

    We generally recommend altering this or `temperature` but not both.

  - `unwantedSequences?: Array<string>`

    Body param: Optional list of words sequences that should not be present in the generated prompts.

### Returns

- `GenerateCaptionResponse`

  - `captions: Array<string>`

    The captions for each image.

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

  - `creativeUnitsCost?: number`

    The Compute Units cost for the request billed

  - `creativeUnitsDiscount?: number`

    The Compute Units discount for the request billed

  - `detailsLevel?: "action" | "action+style"`

    The details level used to generate the captions.

    When a modelId is provided and examples are available, the details level is ignored.

    - `"action"`

    - `"action+style"`

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

const response = await client.generate.caption({ images: ['string'] });

console.log(response.captions);
```

#### Response

```json
{
  "captions": [
    "string"
  ],
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
  "creativeUnitsCost": 0,
  "creativeUnitsDiscount": 0,
  "detailsLevel": "action",
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
