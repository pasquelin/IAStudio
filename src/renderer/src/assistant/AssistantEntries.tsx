import { mdiChatOutline, mdiMicrophone, mdiMicrophoneOff } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { useDictation } from '@/dictation/useDictation'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import { assistantHearsSpeech, useAssistant } from '@/stores/assistant'
import { useBinding } from '@/stores/bindings'

/**
 * The two ways to reach the assistant with a pointer: speak to it, or write to it.
 *
 * They exist because neither was reachable at all. The window opened on ⌘K and dictation went to
 * it on a held ⌥D — both true, both useless: nothing on screen said either, and the studio's one
 * surface built to be spoken to was the only one where speaking was never offered.
 *
 * Two targets rather than one control that guesses from a long press. And the microphone does NOT
 * open the window: one talks to the studio in order to watch it act, and a modal over the screen
 * hides the very thing the sentence was about. The window still comes up on its own for the one
 * thing it must — a question asked before anything is spent.
 */
export function AssistantEntries() {
  const { t } = useTranslation()
  const label = useShortcutLabel()
  const shortcut = label(useBinding('app.assistant'))

  return (
    <>
      <Speak />
      <ToolButton
        icon={mdiChatOutline}
        label={t('assistant.write')}
        description={t('assistant.writeHint')}
        tooltip={TIP_BOTTOM}
        shortcut={shortcut}
        variant="header"
        onClick={() => useAssistant.getState().show()}
      />
    </>
  )
}

/**
 * The microphone that hands the words to the assistant.
 *
 * Not `DictationButton`, and the difference is the point rather than a duplicate: that one runs a
 * dictation session, whose words go wherever the caret is. This one changes where they go first,
 * and it is accented only while the assistant is the one hearing them — accenting it for a session
 * dictating into a prompt would say "you are talking to the assistant" when nobody is.
 */
function Speak() {
  const { t } = useTranslation()
  const dictation = useDictation()
  const toAssistant = useAssistant(assistantHearsSpeech)

  // Hidden rather than disabled, as every microphone of the studio is: a control switched off in
  // the settings has nothing to say. The way in by writing stays, which is the whole reason these
  // are two buttons.
  if (!dictation.enabled) return null

  const talking = toAssistant && dictation.isListening

  return (
    <ToolButton
      icon={talking ? mdiMicrophone : mdiMicrophoneOff}
      label={talking ? t('assistant.stopSpeaking') : t('assistant.speak')}
      description={talking ? t('assistant.stopSpeakingHint') : t('assistant.speakHint')}
      tooltip={TIP_BOTTOM}
      variant="header"
      accented={talking}
      disabled={dictation.state === 'loadingEngine' || dictation.state === 'downloadingModel'}
      onClick={() => {
        const assistant = useAssistant.getState()
        // Not listening TO THE ASSISTANT — a session already dictating into a field included, in
        // which case this hands its words over rather than cutting a person off mid-sentence.
        if (!talking) {
          assistant.listen()
          return
        }

        // Ends whichever session it is: one this button opened is owned by the modal's effect and
        // ends by clearing the claim, one opened from the modal's own microphone ends directly.
        if (assistant.listening) assistant.stopListening()
        else void dictation.stop()
      }}
    />
  )
}
