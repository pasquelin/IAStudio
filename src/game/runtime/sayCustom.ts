// SPDX-License-Identifier: MIT

import type { JsonValue } from '@shared/domain/component'
import type { World } from './world'

/**
 * 🛑 `Custom`, always, carrying the chosen name as DATA: the closed union of `GameEventName` is a
 * value of `@shared/`, which this tree may not read.
 *
 * 🛑 And `name` therefore WINS over a payload of the same key — the one place a name could be
 * carried is the one a payload could shadow. Said here rather than discovered by an author whose
 * `{ name: 'north gate' }` came back as the event's own name.
 */
export function sayCustom(
  world: World,
  name: string,
  entity: string | undefined,
  payload: Readonly<Record<string, JsonValue>> = {},
): void {
  world.events.emit({ name: 'Custom', entity, payload: { ...payload, name } })
}
