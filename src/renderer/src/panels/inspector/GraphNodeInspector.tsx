import { useTranslation } from 'react-i18next'
import { canBeOutput, type GraphNode, type GraphState } from '@shared/domain/graph'
import { PropertyGroup } from '@/design/PropertyGroup'
import { PropertyRow } from '@/design/PropertyRow'
import { TextField } from '@/design/TextField'
import { ToggleField } from '@/design/ToggleField'
import { setGraphNodeData } from '@/engines/graph/commands'
import { HINT_LEFT } from '@/helpers/tooltip'
import { NODE_LABEL_KEYS } from '@/spaces/graph/node-labels'
import { useGraphs } from '@/stores/graphs'
import { ForEachEndFields, ForEachFields } from './ForEachFields'
import { IfElseFields } from './IfElseFields'
import { ModelNodeFields } from './ModelNodeFields'
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

      {/* Offered only where the converter reads it. Marked on any other type it is ignored in
          silence, so a checkbox there would be a promise the compiler does not keep. */}
      {canBeOutput(node.type) && (
        <ToggleField
          label={t('inspector.isOutput')}
          value={node.data.isOutput === true}
          onChange={isOutput => edit.run(setGraphNodeData(node.id, { isOutput }))}
        />
      )}

      {node.type === 'model' && <ModelNodeFields documentId={documentId} node={node} edit={edit} />}

      {node.type === 'text' && (
        <TextField
          label={t('inspector.prompt')}
          value={node.data.value ?? ''}
          onChange={value => edit.run(setGraphNodeData(node.id, { value }))}
          {...edit.gesture}
        />
      )}

      {/* What the person is asked, and the one field of an approval. Left empty the node falls
          back to a sentence of its own, so a graph never stops on a question with no words. */}
      {node.type === 'approval' && (
        <TextField
          label={t('inspector.message')}
          value={node.data.message ?? ''}
          onChange={message => edit.run(setGraphNodeData(node.id, { message }))}
          {...edit.gesture}
        />
      )}

      {/* Under the same `value` the text node writes — Scenario's own naming, not a shape of ours.
          The hint carries what no label can: a wire is named after the node it comes from, and a
          field whose only documentation is a code comment is a field filled blind. */}
      {node.type === 'transformText' && (
        <TextField
          label={t('inspector.expression')}
          value={node.data.value ?? ''}
          onChange={value => edit.run(setGraphNodeData(node.id, { value }))}
          hint={HINT_LEFT(t('inspector.expressionHint'))}
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

      {node.type === 'ifElse' && <IfElseFields documentId={documentId} node={node} edit={edit} />}

      {node.type === 'forEach' && <ForEachFields node={node} edit={edit} />}

      {node.type === 'forEachEnd' && (
        <ForEachEndFields documentId={documentId} node={node} edit={edit} />
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
