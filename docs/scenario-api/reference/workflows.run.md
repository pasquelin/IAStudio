## Run

`client.workflows.run(stringworkflowID, WorkflowRunParamsparams, RequestOptionsoptions?): WorkflowRunResponse`

**put** `/workflows/{workflowId}/run`

Run a workflow

### Parameters

- `workflowID: string`

- `params: WorkflowRunParams`

  - `body: unknown`

    Body param: The request body for the workflow run must be retrieve from GET /workflows/{workflowId} inputs fields

  - `dryRun?: unknown`

    Query param

  - `projectId?: unknown`

    Query param

### Returns

- `WorkflowRunResponse`

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

  - `workflow: Workflow`

    - `id: string`

      Unique identifier of the workflow.

    - `authorId: string`

      User that created the workflow.

    - `createdAt: string`

      ISO string

    - `description: string`

      Full description of what the workflow does.

    - `editorInfo: Record<string, unknown>`

      The UI data about the workflow. This is managed by scenario webapp.

    - `flow: Array<Flow>`

      The flow of the workflow.

      - `id: string`

        The id of the node.

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

      - `workflowId?: string`

        The workflow id for the node. Mainly used for workflow tasks.

    - `inputs: Array<Input>`

      The inputs of the workflow.

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

    - `name: string`

      Human-readable name of the workflow.

    - `ownerId: string`

      Project that owns the workflow.

    - `privacy: "private" | "public" | "unlisted"`

      Visibility setting for the workflow.

      - `"private"`

      - `"public"`

      - `"unlisted"`

    - `shortDescription: string`

      Short summary of the workflow.

    - `status: "deleted" | "draft" | "ready"`

      Current lifecycle status (draft, ready, deleted).

      - `"deleted"`

      - `"draft"`

      - `"ready"`

    - `tagSet: Array<string>`

      The tag set of the workflow.

    - `updatedAt: string`

      ISO string

    - `after?: After`

      A representation of an asset after being processed by the workflow

      - `assetId: string`

        The AssetId of the image used as a thumbnail for your model (example: "asset_GTrL3mq4SXWyMxkOHRxlpw")

      - `url: string`

        The url of the image used as a thumbnail for your model

    - `before?: Before`

      A representation of an asset before being processed by the workflow

      - `assetId: string`

        The AssetId of the image used as a thumbnail for your model (example: "asset_GTrL3mq4SXWyMxkOHRxlpw")

      - `url: string`

        The url of the image used as a thumbnail for your model

    - `embedding?: unknown`

      Embedding is a map of embedding version into embedding date

    - `isLocked?: boolean`

      Whether the workflow is locked. Locked workflows cannot be modified or deleted
      except by the author or a project admin.

    - `lastIndexedAt?: string`

    - `lastIndexingType?: "CREATE" | "DELETE" | "UPDATE"`

      The type of indexing operation to perform in MeiliSearch

      - `"CREATE"`

      - `"DELETE"`

      - `"UPDATE"`

    - `lastReadyFlowUpdatedAt?: string`

      Timestamp when the workflow flow was last saved as a Ready (App) snapshot.
      Used to compute the WorkflowNodes snapshot key.
      Only set for workflows that have been in the Ready state.

    - `lockedStateChangedAt?: string`

      ISO string timestamp when lock state was last changed.

    - `lockedStateChangedBy?: string`

      UserId of the user who last changed the lock state.

    - `outputAssetKinds?: Array<"3d" | "audio" | "document" | 5 more>`

      Asset kinds produced by this workflow (if specified).

      - `"3d"`

      - `"audio"`

      - `"document"`

      - `"image"`

      - `"image-hdr"`

      - `"json"`

      - `"text"`

      - `"video"`

    - `thumbnail?: Thumbnail`

      Currently the thumbnail is identical to the after asset.

      - `assetId: string`

      - `url: string`

    - `uiConfig?: UiConfig`

      The UI configuration for the workflow. This is managed by scenario webapp.

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

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const response = await client.workflows.run('workflowId', { body: {} });

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
  "workflow": {
    "id": "id",
    "authorId": "authorId",
    "createdAt": "createdAt",
    "description": "description",
    "editorInfo": {
      "foo": "bar"
    },
    "flow": [
      {
        "id": "id",
        "type": "custom-model",
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
        "workflowId": "workflowId"
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
    "name": "name",
    "ownerId": "ownerId",
    "privacy": "private",
    "shortDescription": "shortDescription",
    "status": "deleted",
    "tagSet": [
      "string"
    ],
    "updatedAt": "updatedAt",
    "after": {
      "assetId": "assetId",
      "url": "url"
    },
    "before": {
      "assetId": "assetId",
      "url": "url"
    },
    "embedding": {},
    "isLocked": true,
    "lastIndexedAt": "2019-12-27T18:11:19.117Z",
    "lastIndexingType": "CREATE",
    "lastReadyFlowUpdatedAt": "2019-12-27T18:11:19.117Z",
    "lockedStateChangedAt": "lockedStateChangedAt",
    "lockedStateChangedBy": "lockedStateChangedBy",
    "outputAssetKinds": [
      "3d"
    ],
    "thumbnail": {
      "assetId": "assetId",
      "url": "url"
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
    }
  }
}
```
