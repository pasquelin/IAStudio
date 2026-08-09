import { useTranslation } from 'react-i18next'
import type { GraphNode, GraphState } from '@shared/domain/graph'
import { PropertyGroup } from '@/design/PropertyGroup'
import { PropertyRow } from '@/design/PropertyRow'
import { TextField } from '@/design/TextField'
import { setGraphNodeData } from '@/engines/graph/commands'
import { NODE_LABEL_KEYS } from '@/spaces/graph/node-labels'
import { useGraphs } from '@/stores/graphs'
import { useDocumentEdit, type DocumentEdit } from './useDocumentEdit'

export type GraphNodeInspectorProps = { documentId: string; node: GraphNode }

/**
 * One node, read out and edited — a face of the one inspector rather than a panel of its own.
 *
 * What it writes goes through the very history the canvas writes to, so undoing a typed word and
 * undoing a dragged node are the same ⌘Z.
 */
export function GraphNodeInspector({ documentId, node }: GraphNodeInspectorProps) {
  const { t } = useTranslation()
  const edit = useDocumentEdit(useGraphs, documentId)
  const labelKey = NODE_LABEL_KEYS[node.type]

  return (
    <PropertyGroup title={t('inspector.node')}>
      {/* The id, not a name: an edge and a reference call the node by it, and every port id is
          built from it — renaming it would orphan the lot. */}
      <PropertyRow label={t('inspector.nodeId')}>{node.id}</PropertyRow>
      {/* `kind` names what sort of thing this is, as it does for a layer and a track; `type` is
          kept for the medium, as the asset face uses it. */}
      <PropertyRow label={t('inspector.kind')}>{labelKey ? t(labelKey) : node.type}</PropertyRow>
      <TextField
        label={t('inspector.title')}
        value={node.data.title ?? ''}
        onChange={title => edit.run(setGraphNodeData(node.id, { title }))}
        {...edit.gesture}
      />

      {/* Read out rather than edited: which model a generator runs, and the form that goes with
          it, are the next lot — but the node draws its id on the canvas, and a panel that
          describes what is selected must not say less than the rectangle it describes. */}
      {node.type === 'model' && node.data.modelId !== undefined && (
        <PropertyRow label={t('inspector.model')}>{node.data.modelId}</PropertyRow>
      )}

      {node.type === 'text' && (
        <TextField
          label={t('inspector.prompt')}
          value={node.data.value ?? ''}
          onChange={value => edit.run(setGraphNodeData(node.id, { value }))}
          {...edit.gesture}
        />
      )}

      {node.type === 'stickyNote' && (
        <TextField
          label={t('inspector.text')}
          value={node.data.content ?? ''}
          onChange={content => edit.run(setGraphNodeData(node.id, { content }))}
          {...edit.gesture}
        />
      )}

      {node.type === 'asset' && <AssetFields node={node} edit={edit} />}
    </PropertyGroup>
  )
}

/**
 * What an asset node carries, read defensively.
 *
 * `parseGraph` keeps `data` as it found it — it validates the node, not its contents — so these
 * two fields are UNTRUSTED however the type reads. A `"value": null` in a file made `typeof … ===
 * 'object'` true and `.length` throw, and an object under `type` was handed to React as a child:
 * both crash the whole panel into its error boundary, and both came out of a review that ran the
 * file rather than read it.
 */
function AssetFields({ node, edit }: { node: GraphNode; edit: DocumentEdit<GraphState> }) {
  const { t } = useTranslation()
  const { type, value } = node.type === 'asset' ? node.data : { type: undefined, value: undefined }

  return (
    <>
      {typeof type === 'string' && <PropertyRow label={t('inspector.type')}>{type}</PropertyRow>}
      {Array.isArray(value) ? (
        <PropertyRow label={t('inspector.count')}>{value.length}</PropertyRow>
      ) : (
        <TextField
          label={t('inspector.source')}
          value={typeof value === 'string' ? value : ''}
          onChange={next => edit.run(setGraphNodeData(node.id, { value: next }))}
          {...edit.gesture}
        />
      )}
    </>
  )
}
