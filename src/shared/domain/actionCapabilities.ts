import type { DocumentKind } from './document'
import type { TargetKind } from './target'

export type ActionIntent =
  'read' | 'create' | 'mutate' | 'delete' | 'search' | 'execute' | 'remember'
export type ActionDocumentAffinity = 'required' | 'relevant' | 'transversal'
export type ActionTarget =
  | TargetKind
  | 'asset'
  | 'bone'
  | 'camera'
  | 'chat'
  | 'clip'
  | 'component'
  | 'document'
  | 'file'
  | 'favorite'
  | 'generation'
  | 'git'
  | 'job'
  | 'media'
  | 'memory'
  | 'project'
  | 'projectContext'
  | 'rig'
  | 'studio'
  | 'timeline'
  | 'track'
  | 'world'

export type ActionCapabilities = {
  intents?: readonly ActionIntent[]
  targets?: readonly ActionTarget[]
  documentKinds?: readonly DocumentKind[]
  documentAffinity?: ActionDocumentAffinity
}

export type ActionTargetDescriptor = {
  target: ActionTarget
  namespaces: readonly string[]
  names: readonly string[]
}

export const ACTION_TARGET_DESCRIPTORS: readonly ActionTargetDescriptor[] = [
  { target: 'asset', namespaces: ['asset', 'assets'], names: [] },
  { target: 'bone', namespaces: ['bone'], names: ['bone', 'bones', 'os'] },
  { target: 'camera', namespaces: ['camera'], names: ['camera', 'cameras'] },
  { target: 'chat', namespaces: ['chat'], names: ['chat', 'discussion'] },
  { target: 'clip', namespaces: ['clip'], names: ['clip', 'clips', 'plan', 'plans'] },
  {
    target: 'component',
    namespaces: ['component'],
    names: ['component', 'components', 'composant', 'composants'],
  },
  { target: 'document', namespaces: ['document'], names: [] },
  {
    target: 'favorite',
    namespaces: ['favorite', 'favorites'],
    names: ['favorite', 'favorites', 'favourite', 'favourites', 'favori', 'favoris'],
  },
  { target: 'file', namespaces: ['file', 'files'], names: [] },
  { target: 'git', namespaces: ['git'], names: ['git', 'stash', 'stashes'] },
  { target: 'job', namespaces: ['job'], names: [] },
  { target: 'media', namespaces: ['media'], names: ['media', 'medias'] },
  {
    target: 'memory',
    namespaces: ['memory'],
    names: ['memory', 'memoire', 'souvenir', 'souvenirs'],
  },
  { target: 'project', namespaces: ['project', 'projects'], names: [] },
  { target: 'rig', namespaces: ['rig'], names: ['rig', 'skeleton', 'squelette'] },
  { target: 'studio', namespaces: ['studio'], names: [] },
  { target: 'timeline', namespaces: [], names: ['timeline', 'cinematique'] },
  { target: 'track', namespaces: ['track'], names: ['track', 'tracks', 'piste', 'pistes'] },
  {
    target: 'world',
    namespaces: ['world'],
    names: [
      'world',
      'environment',
      'environnement',
      'fog',
      'brouillard',
      'ground',
      'sol',
      'background',
      'arriere-plan',
    ],
  },
]
