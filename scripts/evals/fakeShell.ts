import type { ActionOutcome } from '@shared/domain/assistant'
import { pathBaseNameOf } from '@shared/domain/fileName'
import { answered, done, front, nextId, refused, type Bench } from './bench'
import { byId, flag, text, texts, type Input } from './inputs'

/**
 * Everything around the documents — sections 41 to 45 and 53 to 57.
 *
 * Kept apart from `fakeStudio` on purpose: these are the surfaces a person opens, pins, dictates
 * into or syncs, and none of them belongs to a document. What each one answers is only ever what
 * an oracle needs to read afterwards, never a faithful copy of the studio's own reply.
 */

const held = (bench: Bench, path: string): boolean => bench.files.some(one => one.path === path)

export function shellAction(bench: Bench, action: string, input: Input): ActionOutcome | null {
  const shell = bench.shell

  switch (action) {
    case 'document.remove': {
      const named = text(input, 'documentId')
      const found = bench.documents.find(one => one.id === named || one.title === named)
      if (!found) return refused('notFound')

      bench.documents = bench.documents.filter(one => one !== found)
      if (found.path) bench.files = bench.files.filter(one => one.path !== found.path)
      if (bench.frontId === found.id) bench.frontId = bench.documents.at(-1)?.id ?? null
      return done
    }

    case 'document.export': {
      const open = front(bench)
      if (!open) return refused('wrongSurface')

      const folder = text(input, 'folder') || 'documents'
      const format = text(input, 'format') || 'glb'
      bench.files.push({ path: `${folder}/${open.title}.${format}`, kind: 'file' })
      return done
    }

    case 'project.create':
    case 'project.open': {
      const path = text(input, 'path')
      if (path === '') return refused('badInput')

      bench.projectName = pathBaseNameOf(path)
      return done
    }

    // Two gestures, two lists: showing a file in the Finder is not opening its card, and a
    // bench folding them together scored either request on the other.
    case 'file.reveal': {
      const path = text(input, 'path')
      if (!held(bench, path)) return refused('notFound')

      shell.revealed.push(path)
      return done
    }

    case 'fileInfo.open': {
      const path = text(input, 'path')
      if (!held(bench, path)) return refused('notFound')

      shell.described.push(path)
      return done
    }

    case 'asset.reveal': {
      const asset = byId(bench.assets, input, 'assetId')
      if (!asset) return refused('notFound')

      shell.revealed.push(asset.path ?? asset.name)
      return done
    }

    // Nothing of the project is missing, which is the honest answer for a bench whose files and
    // catalogue are built from the same list.
    case 'assets.absent':
      return answered([])

    case 'assets.describe': {
      const wanted = texts(input, 'assetIds')
      if (wanted.length === 0) return refused('badInput')

      for (const asset of bench.assets.filter(one => wanted.includes(one.id))) {
        asset.tags = [...asset.tags, 'décrit']
      }
      return answered(wanted.map(id => ({ assetId: id, description: 'une image du projet' })))
    }

    case 'job.cancel':
    case 'task.cancel': {
      const id = text(input, 'jobId') || text(input, 'taskId')
      const job = bench.jobs.find(one => one.id === id)
      if (action === 'job.cancel' && !job) return refused('notFound')

      if (job) job.status = 'cancelled'
      return done
    }

    case 'command.run':
      return text(input, 'command') === '' ? refused('badInput') : done

    case 'actions.find':
      return text(input, 'query') === '' ? refused('badInput') : answered([])

    case 'prompt.suggest':
      return text(input, 'draft') === ''
        ? refused('badInput')
        : answered(['un port au coucher du soleil, photoréaliste'])

    case 'prompt.translate':
      return text(input, 'text') === '' ? refused('badInput') : answered({ text: 'a wooden boat' })

    case 'prompt.describeStyle':
      return answered({ style: 'peinture marine, lumière douce' })

    case 'styles.list':
      return answered(shell.styles)

    case 'style.save': {
      const name = text(input, 'name')
      if (name === '') return refused('badInput')

      shell.styles.push({ id: nextId(bench, 'style'), name })
      return done
    }

    case 'style.rename': {
      const style = byId(shell.styles, input, 'styleId')
      const name = text(input, 'name')
      if (!style || name === '') return refused('badInput')

      style.name = name
      return done
    }

    case 'style.remove': {
      const id = text(input, 'styleId')
      if (!shell.styles.some(one => one.id === id)) return refused('notFound')

      shell.styles = shell.styles.filter(one => one.id !== id)
      return done
    }

    case 'cloud.browse':
    case 'cloud.explore':
    case 'cloud.similar':
      return answered([{ id: 'remote-1', name: 'a red sports car' }])

    case 'cloud.plan':
      return text(input, 'policy') === ''
        ? refused('badInput')
        : answered({ pull: ['remote-1'], push: [] })

    case 'cloud.pull': {
      const wanted = texts(input, 'remoteAssetIds')
      if (wanted.length === 0) return refused('badInput')

      shell.pulled.push(...wanted)
      return done
    }

    case 'cloud.push':
      shell.pushed.push(front(bench)?.title ?? 'projet')
      return done

    case 'window.state':
      return answered({ fullScreen: shell.fullScreen, panels: shell.panels })

    case 'window.fullScreen':
      shell.fullScreen = true
      return done

    case 'settings.open':
      if (text(input, 'section') === '') return refused('badInput')

      shell.settingsOpen = true
      return done

    case 'settings.action':
      return text(input, 'action') === '' ? refused('badInput') : done

    case 'panels.list':
      return answered(shell.panels)

    case 'panel.open': {
      const panel = text(input, 'panel')
      if (panel === '') return refused('badInput')

      if (!shell.panels.includes(panel)) shell.panels.push(panel)
      return done
    }

    case 'panel.close': {
      const panel = text(input, 'panel')
      if (panel === '') return refused('badInput')

      shell.panels = shell.panels.filter(one => one !== panel)
      return done
    }

    case 'mirror.open':
      shell.mirrored = true
      return done

    case 'help.open': {
      const page = text(input, 'page')
      if (page === '') return refused('badInput')

      shell.helpAt = page
      return done
    }

    case 'favorites.list':
      return answered(
        shell.favorites.map((one, at) => ({ id: `favorite-${at + 1}`, assetId: one })),
      )

    case 'favorite.pin': {
      const asset = byId(bench.assets, input, 'assetId')
      if (!asset) return refused('notFound')

      if (!shell.favorites.includes(asset.id)) shell.favorites.push(asset.id)
      return done
    }

    // Keyed by the favourite's own id, which is the position it was pinned at — the studio hands
    // one back from `favorites.list` and takes nothing else.
    case 'favorite.unpin': {
      const at = Number(text(input, 'favoriteId').replace('favorite-', '')) - 1
      if (!Number.isInteger(at) || at < 0 || at >= shell.favorites.length)
        return refused('notFound')

      shell.favorites.splice(at, 1)
      return done
    }

    case 'updates.state':
      return answered({ available: true, version: '1.2.0' })

    case 'updates.install':
      shell.updateInstalled = true
      return done

    case 'dictation.state':
      return answered({ ready: true, running: shell.dictating })

    case 'dictation.start':
      shell.dictating = true
      return done

    case 'dictation.stop':
      shell.dictating = false
      return answered({ discarded: flag(input, 'discard') })

    case 'media.capabilities':
      return answered({ hardwareEncode: true })

    case 'media.adopt': {
      const path = text(input, 'path')
      if (path === '') return refused('badInput')

      shell.adopted.push(path)
      if (!held(bench, path)) bench.files.push({ path, kind: 'file' })
      return done
    }

    case 'fonts.list':
      return answered([{ family: 'Inter' }, { family: 'Helvetica' }])

    case 'accounts.list':
      return answered(shell.accounts)

    case 'accounts.activate': {
      const wanted = text(input, 'accountId')
      if (!shell.accounts.some(one => one.id === wanted)) return refused('notFound')

      for (const one of shell.accounts) one.active = one.id === wanted
      return done
    }

    case 'accounts.rename': {
      const account = byId(shell.accounts, input, 'accountId')
      const name = text(input, 'name')
      if (!account || name === '') return refused('badInput')

      account.name = name
      return done
    }

    case 'context.read':
      return answered(
        Object.entries(shell.context).map(([cardId, body]) => ({ cardId, body, active: true })),
      )

    case 'context.write': {
      const body = text(input, 'body')
      if (body === '') return refused('badInput')

      shell.context[text(input, 'cardId') || nextId(bench, 'card')] = body
      return done
    }

    case 'context.remove': {
      const cardId = text(input, 'cardId')
      if (!(cardId in shell.context)) return refused('notFound')

      delete shell.context[cardId]
      return done
    }

    default:
      return null
  }
}
