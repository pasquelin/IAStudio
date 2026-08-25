import type { GitFile } from '@shared/domain/git'
import type { Studio } from './studio'
import type { Run, Scenario } from './run'
import * as read from './oracle'

/**
 * 🛑 Section 58. Every decor but 58.7's runs `git.init` FIRST: on a folder git never saw the
 * handlers refuse everything, and the model would be scored on a refusal it could not avoid.
 */

const BOAT = 'Images/fais moi un bateau.png'

const gitOf = (run: Run) => run.studio.git.repo()

/** The one file the decors say is edited — a working-tree change git itself would report. */
const edit: GitFile = { path: BOAT, change: 'modified', stage: 'unstaged' }

const changed = (run: Run): readonly string[] =>
  gitOf(run)
    .files.filter(one => one.stage !== 'staged')
    .map(one => one.path)

const staged = (run: Run): readonly string[] =>
  gitOf(run)
    .files.filter(one => one.stage === 'staged')
    .map(one => one.path)

const tracked = async (studio: Studio): Promise<void> => {
  await studio.run('git.init', {})
}

/** A project under git with the boat picture edited since the last version. */
const edited = async (studio: Studio): Promise<void> => {
  await tracked(studio)
  studio.git.repo().files.push({ ...edit })
}

const committed = async (studio: Studio): Promise<void> => {
  await edited(studio)
  await studio.run('git.stage', { paths: [BOAT] })
  await studio.run('git.commit', { message: 'Version de départ' })
}

const stashed = async (studio: Studio): Promise<void> => {
  await edited(studio)
  await studio.run('git.stash', { message: 'Travail du soir' })
}

const conflicted = async (studio: Studio): Promise<void> => {
  await committed(studio)
  const repo = studio.git.repo()
  repo.merging = true
  repo.files.push({ path: BOAT, change: 'conflicted', stage: 'conflicted' })
}

export const GIT_SCENARIOS: readonly Scenario[] = [
  {
    name: '58.1 says where the project stands version-wise',
    said: ['Où en est mon projet côté versions ?'],
    setup: edited,
    passed: run => read.spoke(run) && read.answeredWith(run, 'git.status'),
  },
  {
    name: '58.2 lists the versions already recorded',
    said: ['Montre-moi mes dernières versions enregistrées.'],
    setup: committed,
    passed: run => read.spoke(run) && read.answeredWith(run, 'git.log'),
  },
  {
    name: '58.3 names the files the last version changed',
    said: ['Quels fichiers a changé ma dernière version ?'],
    setup: committed,
    passed: run => read.spoke(run) && read.answeredWith(run, 'git.commitFiles'),
  },
  {
    name: '58.4 shows what changed in the boat picture since the last version',
    said: ["Montre-moi ce qui a changé dans l'image du bateau depuis la dernière version."],
    setup: committed,
    passed: run => read.spoke(run) && read.answeredWith(run, 'git.diff'),
  },
  {
    name: '58.5 names the branches of the project',
    said: ['Quelles branches ai-je dans ce projet ?'],
    setup: committed,
    passed: run => read.spoke(run) && read.answeredWith(run, 'git.branches'),
  },
  {
    name: '58.6 names the stashes waiting',
    said: ['Quelles mises de côté ai-je en attente ?'],
    setup: stashed,
    passed: run => read.spoke(run) && read.answeredWith(run, 'git.stashes'),
  },
  {
    name: '58.7 puts the project under version control',
    said: ['Mets ce projet sous suivi de versions.'],
    passed: run => gitOf(run).tracked,
  },
  {
    name: '58.8 stages the boat picture for the next version',
    said: ["Prépare l'image du bateau pour la prochaine version."],
    setup: edited,
    passed: run => staged(run).includes(BOAT),
  },
  {
    name: '58.9 takes the boat picture back out of what is staged',
    said: ["Retire l'image du bateau de ce qui est préparé."],
    setup: async studio => {
      await edited(studio)
      await studio.run('git.stage', { paths: [BOAT] })
    },
    // Out of the staged list and STILL an edit: unstaging keeps the work, which is the whole
    // difference with the request below.
    passed: run => !staged(run).includes(BOAT) && changed(run).includes(BOAT),
  },
  {
    name: '58.10 throws the boat picture edits away',
    said: ["Annule mes modifications sur l'image du bateau et reviens à la dernière version."],
    // Edited AFTER the version was recorded: committing clears `changed`, so a decor stopping
    // there left the oracle already true and doing nothing passed.
    setup: async studio => {
      await committed(studio)
      studio.git.repo().files.push({ ...edit })
    },
    passed: run => !changed(run).includes(BOAT),
  },
  {
    name: '58.11 records a version called Premier jet',
    said: ['Enregistre une version appelée Premier jet.'],
    setup: async studio => {
      await edited(studio)
      await studio.run('git.stage', { paths: [BOAT] })
    },
    passed: run => gitOf(run).commits.some(one => one.message.includes('Premier jet')),
  },
  {
    name: '58.12 makes a branch called essai-couleurs',
    said: ['Crée une branche appelée essai-couleurs.'],
    setup: committed,
    passed: run => gitOf(run).branches.includes('essai-couleurs'),
  },
  {
    name: '58.13 switches to essai-couleurs',
    said: ['Bascule sur la branche essai-couleurs.'],
    setup: async studio => {
      await committed(studio)
      await studio.run('git.createBranch', { name: 'essai-couleurs' })
    },
    passed: run => gitOf(run).branch === 'essai-couleurs',
  },
  {
    name: '58.14 puts the work in progress aside',
    said: ['Mets mon travail en cours de côté.'],
    setup: edited,
    passed: run => gitOf(run).stashes.length === 1 && changed(run).length === 0,
  },
  {
    name: '58.15 brings the stashed work back',
    said: ["Reprends le travail que j'avais mis de côté."],
    setup: stashed,
    // Back, not merely gone: a bench spliced the list for both gestures and scored « reprends »
    // on a drop.
    passed: run => gitOf(run).stashes.length === 0 && changed(run).includes(BOAT),
  },
  {
    name: '58.16 throws the stash away',
    said: ["Jette la mise de côté que je n'utiliserai pas."],
    setup: stashed,
    passed: run => gitOf(run).stashes.length === 0 && !changed(run).includes(BOAT),
  },
  {
    name: '58.17 tags the current version v1',
    said: ['Pose une étiquette v1 sur la version actuelle.'],
    setup: committed,
    passed: run => gitOf(run).tags.includes('v1'),
  },
  {
    name: '58.18 resolves the boat conflict on our side',
    said: ["J'ai un conflit sur l'image du bateau : garde ma version."],
    setup: conflicted,
    passed: run => gitOf(run).files.every(one => one.stage !== 'conflicted'),
  },
  {
    name: '58.19 gives up the merge under way',
    said: ['Abandonne la fusion en cours.'],
    setup: conflicted,
    passed: run => !gitOf(run).merging,
  },
  {
    name: '58.20 names the remotes configured',
    said: ['Quels dépôts distants sont configurés ?'],
    setup: committed,
    passed: run => read.spoke(run) && read.answeredWith(run, 'git.remotes'),
  },
  {
    name: '58.21 adds the origin remote',
    said: ['Ajoute mon dépôt distant origin, sur https://example.com/demo.git.'],
    setup: committed,
    passed: run => gitOf(run).remotes.length === 1,
  },
  {
    name: '58.22 fetches what changed on the remote',
    said: ['Récupère ce qui a changé sur le dépôt distant.'],
    setup: committed,
    passed: run => gitOf(run).fetched && !gitOf(run).pulled,
  },
  {
    name: '58.23 pulls the remote changes in',
    said: ['Récupère et applique les changements du dépôt distant.'],
    setup: committed,
    passed: run => gitOf(run).pulled,
  },
  {
    name: '58.24 pushes the versions to the remote',
    said: ['Envoie mes versions sur le dépôt distant.'],
    setup: committed,
    passed: run => gitOf(run).pushed,
  },
]
