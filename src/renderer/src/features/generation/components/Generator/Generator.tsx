import { mdiCreationOutline } from '@mdi/js'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { isFinished, type Job } from '@shared/domain/job'
import { partsOfRole, type AiRoleId } from '@shared/domain/aiRole'
import { CATALOGUE_FAMILIES } from '@shared/domain/model'
import type { ContextUse } from '@shared/domain/projectContext'
import { useDescriptor } from '@/hooks/useDescriptor'
import { useTaskChoices } from '@/hooks/useTaskChoices'
import { useGenerationContext } from '@/hooks/useGenerationContext'
import { useModelForCapability } from '@/hooks/useModelForCapability'
import { usePlanAccess } from '@/hooks/usePlanAccess'
import { usePlanRefusal } from '@/hooks/usePlanRefusal'
import { modelIsOnThisMachine } from '@/helpers/modelForCapability'
import { referencePictures, type FormValues } from '@/helpers/dynamicForm'
import { fillSourceFields } from '@/features/image/components/aiFields'
import { withBodyExtras } from '@/generation/bodyExtras'
import { landingChoiceOf, landingCreatesOf, landingSiblingsOf } from '@/generation/landingChoice'
import { roleFolderOf, useFolderRoles } from '@/stores/folderRoles'
import { registerGenerator } from '@/features/assistant/generatorBridge'
import { useJobs } from '@/stores/jobs'
import { useGeneration } from '@/stores/generation'
import { useModels } from '@/stores/models'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { claimOnSubmit, documentAwaits } from '@/stores/generationClaims'
import type { LandingTarget } from '@shared/domain/landingTarget'
import { useAiModels } from '@/stores/aiModels'
import { useSettings } from '@/stores/settings'
import { useAccounts } from '@/stores/accounts'
import { cloudsHeldFor } from '@/features/models/modelFilters'
import { EmptyState } from '@/components/EmptyState'
import { MissingCredentials } from '@/features/shell/components/MissingCredentials'
import { NoProject } from '@/features/shell/components/NoProject'
import { useCostEstimate } from '@/hooks/useCostEstimate'
import { usePixelArtGrid } from '@/hooks/usePixelArtGrid'
import { GeneratorForm } from './GeneratorForm'
import { DynamicForm } from '@/components/dynamicFormLazy'

/**
 * The one panel a generation is run from — ADR-23. The operation the workspace points at, the
 * model that serves it, what is about to be sent, and the form the model's own schema describes.
 *
 * No field here is written for any particular model (invariant 5), and nothing about any
 * particular operation either: both come from the contract and the descriptor.
 */
export function Generator() {
  const { t } = useTranslation()

  const forced = useGeneration(state => state.forcedCapability)
  const forceCapability = useGeneration(state => state.forceCapability)
  const { inputs, capability, withdraw } = useGenerationContext(forced)

  const prepared = useModels(state =>
    capability.chosen ? state.preset[capability.chosen] : undefined,
  )
  const modelId = useModelForCapability(capability.chosen)
  const role = capability.chosen
  const family = familyOf(role)

  const authenticated = useSettings(state => state.auth.authenticated)
  const accounts = useAccounts(state => state.accounts)
  const landingChoice = useSettings(state => state.settings.generation.landing)
  const setValue = useSettings(state => state.setValue)
  const project = useProject(state => state.project)
  // 🛑 The ANSWER, never `state.overview`: the manager republishes the whole overview per percent
  // of a load, and a subscription to the object re-rendered this panel with it.
  const onThisMachine = useAiModels(
    state => modelId !== null && modelIsOnThisMachine(modelId, state.overview),
  )
  const catalogueRead = useAiModels(state => state.overview !== null)
  const submit = useJobs(state => state.submit)

  const descriptor = useDescriptor(modelId)

  const fields = useTaskChoices(descriptor.data?.fields, modelId)

  const sources = useMemo(() => fillSourceFields(fields, inputs), [fields, inputs])
  const preset = useMemo(() => ({ ...sources, ...prepared }), [sources, prepared])
  const [contextUse, setContextUse] = useState<ContextUse>('apply')
  // Held OUTSIDE `values`, like the context's own: it must never reach `buildBody`, and
  // `unchangedSince` compares raw values to raw values.
  const [pixelArt, setPixelArt] = useState(true)
  const pixelArtGrid = usePixelArtGrid()

  const choice = useDocuments(
    useShallow(state => landingChoiceOf(role, state, landingChoice, documentAwaits())),
  )
  const [deviated, setDeviated] = useState<{ from: AiRoleId; to: LandingTarget } | null>(null)
  const offered = choice.derived
  const landing = landingOf(role, deviated, offered)

  // Before the guards below return early: a hook cannot be called conditionally.
  const cost = useCostEstimate(modelId, fields, contextUse)
  const plan = usePlanAccess()
  const refusalFor = usePlanRefusal(plan)

  const body = useRef<FormValues>({})

  const [runningId, setRunningId] = useState<string | null>(null)
  const running = useJobs(state => state.jobs.find(job => job.id === runningId) ?? null)
  /**
   * 🛑 Closed BEFORE the round trip and not after it: `submit` reaches the main process, and a
   * second press while it is in flight pays for two generations. `running` cannot answer for that
   * window — the job has no id yet.
   */
  const [submitting, setSubmitting] = useState(false)
  /** The values held back while the question is on screen — the run has not started. */
  const [asking, setAsking] = useState<FormValues | null>(null)

  /**
   * Runs the generation and answers the job, which the button's own handler discards.
   *
   * The claim is part of it, not around it: which workspace has somewhere to put the result is
   * settled at the click, and a second path that skipped it would land generations nowhere.
   */
  const runGeneration = useCallback(
    async (values: FormValues, into?: LandingTarget): Promise<Job | null> => {
      if (!modelId) return null
      const claim = claimOnSubmit(into, role)
      setSubmitting(true)

      try {
        // What the workspace holds and no model schema publishes — `bodyExtras` owns the table.
        const job = await submit(
          { id: modelId },
          withBodyExtras(role, values, { fields, pixelArt }),
          contextUse,
        )
        claim(job)
        setRunningId(job?.id ?? null)
        return job
      } finally {
        setSubmitting(false)
      }
    },
    [modelId, submit, contextUse, role, fields, pixelArt],
  )

  useEffect(() => {
    const armedBody = (): { modelId: string; values: FormValues } | null =>
      modelId ? { modelId, values: body.current } : null

    return registerGenerator({
      body: armedBody,
      armed: () => {
        const armed = armedBody()
        if (!armed || !role) return null

        return {
          modelId: armed.modelId,
          operation: role,
          family,
          sources: inputs,
          // 🛑 `landing` over `choice.target`: what the control shows is what the button sends,
          // and `null` is kept for the one case a caller must answer rather than inherit.
          landing: {
            ...choice,
            target: landing ?? choice.target,
            // On DEMAND, never on the render path — `landingCreatesOf` says what it costs.
            creates: landingCreatesOf(
              role,
              landingSiblingsOf(
                role,
                useDocuments.getState(),
                roleFolderOf(useFolderRoles.getState(), 'script'),
              ),
            ),
          },
          parameters: armed.values,
        }
      },
      submit: into => runGeneration(body.current, into),
      // Which fields hold a picture is a fact of the model's schema, and this panel is the
      // only place that has it — see `GeneratorBridge`.
      references: () => referencePictures(fields, body.current),
    })
  }, [modelId, role, family, inputs, choice, landing, runGeneration, fields])

  const watchValues = cost.onValuesChange
  const onValuesChange = useCallback(
    (values: FormValues) => {
      body.current = values
      watchValues(values)
    },
    [watchValues],
  )

  /**
   * The last door before the spend, for everything that arms a model without opening the picker:
   * a stored default, "recreate", "regenerate with these parameters", a Spark idea and the canvas
   * edits all land here. Greying the picker alone would leave every one of them to discover the
   * 403.
   */
  const refusal = refusalFor(descriptor.data?.requiredPlanLevel)

  /**
   * 🛑 Whether ANY held cloud serves this family, never the Scenario key alone: a model of this
   * machine needs no account, a family no catalogue publishes needs none — a person holding an
   * Anthropic key alone was shown the Scenario form in Code — and neither does a family a SECOND
   * cloud serves. Read on `authenticated` alone, a Tripo key was refused its own 3D and Image
   * forms, with fifty models the picker was listing right beside it.
   */
  if (!capability.chosen) {
    return <EmptyState icon={mdiCreationOutline} message={t('generation.noOperation')} />
  }
  const blocker = generatorBlocker({
    family,
    authenticated,
    accounts,
    onThisMachine,
    catalogueRead,
    project,
    t,
  })
  if (blocker) return blocker
  const chosen = capability.chosen

  // Claimed at the click and settled when the job id arrives: which workspace has somewhere to
  // put a result is not this panel's business — it serves every one of them.
  /**
   * 🛑 Asked BEFORE the run, never after: the answer decides where minutes of compute land, and
   * a question raised when the picture arrives is one nobody is still watching for.
   */
  const generate = (values: FormValues): void => {
    // The operation's own answer wins over the preference: where a script goes is a property of
    // the request, and asking again what `code2code` settles is a question with one answer.
    const target = landing ?? choice.target
    if (target === null) return setAsking(values)
    void runGeneration(values, target)
  }

  return (
    <GeneratorForm
      asking={asking}
      Form={DynamicForm}
      setAsking={setAsking}
      answerLanding={(target, remember) => {
        const values = asking
        setAsking(null)
        if (!values) return
        if (remember) void setValue('generation.landing', target)
        void runGeneration(values, target)
      }}
      capability={capability}
      onForce={forceCapability}
      model={{ capability: chosen, modelId, name: descriptor.data?.name, plan }}
      descriptor={{
        pending: descriptor.isPending,
        error: descriptorError(descriptor.isError, descriptor.error),
        ready: descriptor.data !== undefined,
      }}
      sourcesInput={{ inputs, onWithdraw: withdraw }}
      context={{
        fields,
        modelId: modelId!,
        role: chosen,
        use: contextUse,
        onUse: setContextUse,
      }}
      pixelArt={{ fields, grid: pixelArtGrid, applies: pixelArt, onApplies: setPixelArt }}
      role={role}
      offered={offered}
      landing={landing}
      landingChoice={choice}
      onLanding={target => setDeviated({ from: chosen, to: target })}
      running={running}
      refusal={refusal}
      submitNote={cost.note}
      form={{
        fields,
        onSubmit: generate,
        onValuesChange,
        busy: generationBusy(refusal, submitting, running),
        preset,
        sources,
      }}
    />
  )
}

function familyOf(role: AiRoleId | null) {
  if (!role) return null
  return partsOfRole(role)?.family ?? null
}

function landingOf(
  role: AiRoleId | null,
  deviated: { from: AiRoleId; to: LandingTarget } | null,
  offered: LandingTarget | null,
) {
  if (role !== null && deviated?.from === role) return deviated.to
  return offered
}

type BlockerInput = {
  family: ReturnType<typeof familyOf>
  authenticated: boolean
  accounts: ReturnType<typeof useAccounts.getState>['accounts']
  onThisMachine: boolean
  catalogueRead: boolean
  project: ReturnType<typeof useProject.getState>['project']
  t: ReturnType<typeof useTranslation>['t']
}

function generatorBlocker(input: BlockerInput): ReactNode {
  const served =
    input.family === null ? [] : cloudsHeldFor(input.family, input.authenticated, input.accounts)
  const needsCredentials =
    served.length === 0 &&
    !input.onThisMachine &&
    input.family !== null &&
    CATALOGUE_FAMILIES.includes(input.family)
  if (needsCredentials && !input.catalogueRead)
    return <EmptyState icon={mdiCreationOutline} message={input.t('collection.loading')} />
  if (needsCredentials) return <MissingCredentials icon={mdiCreationOutline} />
  if (!input.project)
    return <NoProject icon={mdiCreationOutline} message={input.t('generation.noProject')} />
  return null
}

function descriptorError(failed: boolean, error: unknown): unknown {
  return failed ? error : null
}

function generationBusy(
  refusal: string | undefined,
  submitting: boolean,
  running: Job | null,
): boolean {
  if (refusal !== undefined || submitting) return true
  return running !== null && !isFinished(running.status)
}
