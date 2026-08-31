import { mdiCreationOutline } from '@mdi/js'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { isFinished, type Job } from '@shared/domain/job'
import { partsOfRole, type AiRoleId } from '@shared/domain/aiRole'
import { CATALOGUE_FAMILIES } from '@shared/domain/model'
import type { ContextUse } from '@shared/domain/projectContext'
import { useDescriptor } from '@/hooks/useDescriptor'
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
import { dictationAccessory } from '@/features/dictation/components/Dictation/DictationField'
import { failureKeyOf } from '@/services/failureMessage'
import { useJobs } from '@/stores/jobs'
import { useGeneration } from '@/stores/generation'
import { useModels } from '@/stores/models'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { claimOnSubmit, documentAwaits } from '@/stores/generationClaims'
import type { LandingTarget } from '@shared/domain/landingTarget'
import { GeneratorLanding } from './Landing/GeneratorLanding'
import { GeneratorLandingDialog } from './Landing/GeneratorLandingDialog'
import { useAiModels } from '@/stores/aiModels'
import { useSettings } from '@/stores/settings'
import { DynamicForm } from '@/components/dynamicFormLazy'
import { cn } from '@/helpers/cn'
import { PANEL_SCROLL } from '@/components/styles'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MissingCredentials } from '@/features/shell/components/MissingCredentials'
import { NoProject } from '@/features/shell/components/NoProject'
import { useCostEstimate } from '@/hooks/useCostEstimate'
import { GeneratorContext } from './GeneratorContext'
import { GeneratorModel } from './GeneratorModel'
import { GeneratorOperation } from './GeneratorOperation'
import { GeneratorRun } from './GeneratorRun'
import { GeneratorSources } from './GeneratorSources'

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

  // Set by the inspector's "regenerate with these parameters"; ordinary generation leaves it
  // undefined and every field opens on its own default.
  //
  // It is deliberately not cleared once used: `DynamicForm` rebuilds its defaults whenever the
  // preset changes, so dropping it would blank the form under the hand that is filling it. It
  // stays until the next "regenerate" replaces it, which reads as the last settings used.
  const prepared = useModels(state =>
    capability.chosen ? state.preset[capability.chosen] : undefined,
  )
  const modelId = useModelForCapability(capability.chosen)
  const role = capability.chosen
  const family = (role && partsOfRole(role)?.family) ?? null

  const authenticated = useSettings(state => state.auth.authenticated)
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

  /**
   * 🛑 What the form opens on: the values an edit prepared, over the sources the workspace holds.
   *
   * Without this the panel DREW the sources and sent none of them — while those same sources
   * decided which operation ran. Selecting a picture switched the generator to image-to-image and
   * left the picture behind.
   */
  const sources = useMemo(
    () => fillSourceFields(descriptor.data?.fields ?? [], inputs),
    [descriptor.data, inputs],
  )
  const preset = useMemo(() => ({ ...sources, ...prepared }), [sources, prepared])
  /**
   * Whether this shot carries the project's context. Held here and not in `values`: it must never
   * reach `buildBody`, which is what is sent to the API.
   *
   * Not reset after a run — « leave the context out of this shot » means without setting a card
   * aside, not once.
   */
  const [contextUse, setContextUse] = useState<ContextUse>('apply')

  /** Where this shot lands and the files it names — composed once, and read by the bridge too. */
  const choice = useDocuments(
    useShallow(state => landingChoiceOf(role, state, landingChoice, documentAwaits())),
  )
  /**
   * The deviation carries the OPERATION it was made against, so it never reaches another one. It
   * is MASKED, not dropped: coming back to the same operation restores it, as `contextUse` does.
   * Keyed on what the operation DERIVED, two operations deriving the same answer shared it.
   */
  const [deviated, setDeviated] = useState<{ from: AiRoleId; to: LandingTarget } | null>(null)
  const offered = choice.derived
  const landing = role !== null && deviated?.from === role ? deviated.to : offered

  // Before the guards below return early: a hook cannot be called conditionally.
  const cost = useCostEstimate(modelId, descriptor.data?.fields, contextUse)
  const plan = usePlanAccess()
  const refusalFor = usePlanRefusal(plan)

  /**
   * The body as the form stands, kept for whoever asks from outside — today the assistant, which
   * has to see what would be sent before it may quote a cost and ask for a yes.
   *
   * A ref rather than state: this changes on every keystroke, and the panel has no reason to
   * re-render because something that is not on screen wants to read it. `useCostEstimate`
   * subscribes to the same feed for the same reason.
   */
  const body = useRef<FormValues>({})

  /**
   * The generation this panel launched, followed until it stops — § 30.
   *
   * Held by id rather than by the job itself: the main process pushes progress every couple of
   * seconds, and a copy kept here would be the stale half of two answers.
   */
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
        const job = await submit({ id: modelId }, withBodyExtras(role, values), contextUse)
        claim(job)
        setRunningId(job?.id ?? null)
        return job
      } finally {
        setSubmitting(false)
      }
    },
    [modelId, submit, contextUse, role],
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
      references: () => referencePictures(descriptor.data?.fields ?? [], body.current),
    })
  }, [modelId, role, family, inputs, choice, landing, runGeneration, descriptor.data])

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
   * 🛑 The SCENARIO key, and only where Scenario can serve: a model of this machine needs no
   * account, and neither does a family no catalogue publishes — a person holding an Anthropic key
   * alone was shown the Scenario form in Code, with no way past it.
   */
  if (!authenticated && !onThisMachine && family !== null && CATALOGUE_FAMILIES.includes(family)) {
    if (!catalogueRead) {
      return <EmptyState icon={mdiCreationOutline} message={t('collection.loading')} />
    }

    return <MissingCredentials icon={mdiCreationOutline} />
  }

  // A job collects into its own project and nowhere else, so generating without one produces
  // assets that land nowhere. The panel asks for a project rather than drawing a form whose
  // button is dead — which is what it did, with one muted line to say why.
  if (!project) return <NoProject icon={mdiCreationOutline} message={t('generation.noProject')} />

  // Said rather than hidden — § 26: what the workspace holds reaches no operation of this
  // family, and inventing a conversion to reach one is what ADR-23 forbids.
  if (!capability.chosen) {
    return <EmptyState icon={mdiCreationOutline} message={t('generation.noOperation')} />
  }

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
    <>
      {asking && (
        <GeneratorLandingDialog
          onCancel={() => setAsking(null)}
          onAnswer={(target, remember) => {
            const values = asking
            setAsking(null)
            if (remember) void setValue('generation.landing', target)
            void runGeneration(values, target)
          }}
        />
      )}
      {/* The gutter and the rhythm live HERE, once: every child wore its own `px-2 pt-2` and the
          one that forgot read as a second panel. `PANEL_SCROLL` keeps the right edge off the bar. */}
      <div className={cn(PANEL_SCROLL, 'gap-2 pt-2 pl-2')}>
        <GeneratorOperation capability={capability} onForce={forceCapability} />
        <GeneratorModel
          capability={capability.chosen}
          modelId={modelId}
          name={descriptor.data?.name}
          plan={plan}
        />

        {/* Gated on a model: `useDescriptor(null)` is disabled, and a disabled query reads as
          pending — so two sentences were painted one under the other. Having none is said by
          `GeneratorModel`, which is the only one that knows whether the catalogue is empty. */}
        {modelId !== null && descriptor.isPending && (
          <EmptyState icon={mdiCreationOutline} message={t('collection.loading')} />
        )}
        {modelId !== null && descriptor.isError && (
          <EmptyState icon={mdiCreationOutline} message={t(failureKeyOf(descriptor.error))} />
        )}

        <GeneratorSources inputs={inputs} onWithdraw={withdraw} />
        {/* Gated on the model as well as the descriptor: `prepare` ARMS what it is handed, and an
            empty id would arm nothing under the name of nothing. */}
        {descriptor.data && modelId !== null && (
          <GeneratorContext
            fields={descriptor.data.fields}
            modelId={modelId}
            role={capability.chosen}
            use={contextUse}
            onUse={setContextUse}
          />
        )}
        {/* Below the sources and above the run: what is sent, then where it lands, then the
            generation itself — the order the eye reads the panel in. */}
        {role !== null && offered !== null && landing !== null && (
          <GeneratorLanding
            role={role}
            choice={choice}
            landing={landing}
            onLanding={target => setDeviated({ from: role, to: target })}
          />
        )}
        <GeneratorRun job={running} />

        {/* Refused by the subscription, not by the studio — saying so beats a 403 nobody reads. */}
        {refusal && <p className="text-muted text-xs">{refusal}</p>}

        {/* Gated on the descriptor, which is what makes the deferred form free to the eye: it only
          renders once that round trip has come back, so the wait its chunk adds sits inside one
          the panel already had. */}
        {descriptor.data && (
          // Above the `Suspense`: a rejected `lazy()` import is an error, not a fallback. Without
          // it the throw leaves the panel, leaves the dock, and takes the whole window down.
          <ErrorBoundary>
            <Suspense
              fallback={<EmptyState icon={mdiCreationOutline} message={t('collection.loading')} />}
            >
              <DynamicForm
                fields={descriptor.data.fields}
                onSubmit={generate}
                submitLabel={t('actions.generate')}
                submitHint={t('actions.generateHint')}
                submitNote={cost.note}
                onValuesChange={onValuesChange}
                // 🛑 The double-submission guard as well as the refusal: `submit` is a round trip,
                // and a second press before it answers pays for two generations.
                // `project` is not in this: the panel returns before the form when there is none.
                busy={
                  refusal !== undefined ||
                  submitting ||
                  (running !== null && !isFinished(running.status))
                }
                preset={preset}
                sources={sources}
                // Dictation alone now. Rewriting a prompt, translating it and reading the style of
                // the references left this panel for the assistant: they are things one ASKS for,
                // and three buttons under a field could only ever offer three of them.
                accessory={dictationAccessory}
              />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </>
  )
}
