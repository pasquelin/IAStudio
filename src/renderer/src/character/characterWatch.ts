import { characterStore, seedCharacter } from '@/stores/character'
import { characterMessageOf, openCharacterChannel } from './characterChannel'

/**
 * The studio's end of the character channel.
 *
 * 🛑 Every assistant action runs in the STUDIO window — `connectRemoteActions` is mounted by
 * `Application`, which the skeleton window never renders. Without this the ten skeleton actions
 * would look for a character in a store nothing on this side ever fills.
 */
export function watchTheCharacterWindow(): () => void {
  const channel = openCharacterChannel()

  channel.onmessage = event => {
    const message = characterMessageOf(event.data)
    if (!message) return

    if (message.kind === 'holds') seedCharacter(message.assetId, message.rig, {})
    // Let go here too, or an action looking for « the open character » would keep finding the
    // first one this studio was ever told about.
    if (message.kind === 'dropped') characterStore.use.getState().drop(message.assetId)
  }

  return () => channel.close()
}
