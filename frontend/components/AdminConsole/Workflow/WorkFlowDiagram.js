import React from 'react'
import { useIntl } from 'react-intl'
import { connect } from 'react-redux'
import { Loading, axios } from '../../../client'
import { Icon } from '../../../elements'
import { parseWorkflowItems, buildGraph, validateWorkflow, makeStatusLabeller, statusEnumNames, NODE_W, NODE_H } from './workflowGraph'

const { useReducer, useEffect, useRef } = React

const ZOOM_MIN = 0.4
const ZOOM_MAX = 2
const ZOOM_STEP = 0.2

const EDGE_STYLE = {
  success: { stroke: '#6b7280', width: 1.6, dash: undefined },
  default: { stroke: '#0d6efd', width: 2.4, dash: undefined },
  failed: { stroke: '#dc3545', width: 1.6, dash: '5 4' },
}

const SEVERITY_ICON = { error: 'IconAlertCircle', warning: 'IconAlertTriangle', info: 'IconInfoCircle' }

const truncate = (text, max) => (text && text.length > max ? `${text.slice(0, max - 1)}…` : text || '')

const sameWords = (label, code) => {
  const strip = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  return strip(label) === strip(code)
}

const clampZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))

// Renders the workflow items of one automaton as a state diagram plus a consistency report. The
// grid next to it lists the same rows; this view is what makes an unreachable status or a duplicated
// transition visible at a glance.
const WorkFlowDiagram = (props) => {
  const intl = useIntl()
  const fmt = (id, values) => intl.formatMessage({ id, defaultMessage: id }, values)
  const label = (id, values) => fmt(`perun.admin_console.${id}`, values)

  const initialState = { loading: true, failed: false, items: [], enumNames: {}, zoom: 1, showLabels: true, selected: undefined }
  const reducer = (currState, update) => ({ ...currState, ...update })
  const [{ loading, failed, items, enumNames, zoom, showLabels, selected }, setState] = useReducer(reducer, initialState)

  const canvasRef = useRef(null)

  const { autoId, svSession, refreshToken, onItemClick } = props

  useEffect(() => {
    if (!svSession) return undefined
    let cancelled = false
    setState({ loading: true, failed: false })
    const itemsUrl = `${window.server}/ReactElements/getObjectsByParentId/${svSession}/${autoId}/SVAROG_WORKFLOW_ITEM/0`
    const schemaUrl = `${window.server}/ReactElements/getTableJSONSchema/${svSession}/SVAROG_WORKFLOW_ITEM`
    // The schema is only used to put readable names on the status codes, so a failure there must not
    // take the diagram down with it.
    Promise.all([axios.get(itemsUrl), axios.get(schemaUrl).catch(() => undefined)])
      .then(([itemsRes, schemaRes]) => {
        if (cancelled) return
        // The interceptor resolves a 401 or 502/503 as undefined; that is a failed load, not an
        // automaton without transitions.
        if (!itemsRes) {
          setState({ loading: false, failed: true, items: [] })
          return
        }
        setState({
          loading: false,
          items: parseWorkflowItems(itemsRes && itemsRes.data),
          enumNames: statusEnumNames(schemaRes && schemaRes.data),
        })
      })
      .catch(() => {
        if (cancelled) return
        setState({ loading: false, failed: true, items: [] })
      })
    return () => { cancelled = true }
  }, [autoId, svSession, refreshToken])

  const statusLabel = makeStatusLabeller(enumNames, (id) => fmt(id))

  // Hand the item name back with the id so the form modal can title itself with the transition that
  // was clicked, rather than whatever row was opened from the grid last.
  const openItem = (objectId) => {
    if (!onItemClick) return
    const match = items.find((i) => i.objectId === objectId)
    onItemClick(objectId, match ? match.name : '')
  }

  const graph = buildGraph(items)
  const issues = validateWorkflow(items)

  const fitToWidth = () => {
    const available = canvasRef.current && canvasRef.current.clientWidth
    if (!available || !graph.width) return
    setState({ zoom: clampZoom((available - 8) / graph.width) })
  }

  const toggleSelected = (name) => setState({ selected: selected === name ? undefined : name })

  const isDimmed = (from, to) => selected !== undefined && from !== selected && to !== selected

  const renderMarkers = () => Object.keys(EDGE_STYLE).map((kind) => (
    <marker
      key={kind}
      id={`wf-arrow-${kind}-${autoId}`}
      viewBox='0 0 10 10'
      refX='9'
      refY='5'
      markerWidth='7'
      markerHeight='7'
      orient='auto-start-reverse'
    >
      <path d='M 0 0 L 10 5 L 0 10 z' fill={EDGE_STYLE[kind].stroke} />
    </marker>
  ))

  const renderEdge = (edge) => {
    const style = EDGE_STYLE[edge.kind] || EDGE_STYLE.success
    const dimmed = isDimmed(edge.from, edge.to)
    const tooltip = [
      edge.item.name,
      `${edge.from} → ${edge.kind === 'failed' ? edge.item.failed : edge.item.to}`,
      edge.item.successRule && `${label('wf_rule_success')}: ${edge.item.successRule}`,
      edge.item.failedRule && `${label('wf_rule_failed')}: ${edge.item.failedRule}`,
      edge.item.defaultRule && `${label('wf_rule_default')}: ${edge.item.defaultRule}`,
      edge.item.permissionCode && `${label('wf_permission')}: ${edge.item.permissionCode}`,
    ].filter(Boolean).join('\n')

    return (
      <g
        key={edge.key}
        className='wf-diagram-edge'
        opacity={dimmed ? 0.12 : 1}
        onClick={() => openItem(edge.item.objectId)}
      >
        <title>{tooltip}</title>
        {/* Wide transparent copy of the path so the arrow is comfortable to click and hover. */}
        <path d={edge.path} fill='none' stroke='transparent' strokeWidth='12' />
        <path
          d={edge.path}
          fill='none'
          stroke={style.stroke}
          strokeWidth={style.width}
          strokeDasharray={style.dash}
          markerEnd={`url(#wf-arrow-${edge.kind}-${autoId})`}
        />
        {/* The failed edge belongs to the same item as its success edge, so labelling it again only
            doubles the text where the graph is busiest. */}
        {showLabels && edge.kind !== 'failed' && edge.item.name && (
          <text
            x={edge.lx}
            y={edge.ly}
            textAnchor='middle'
            fontSize='10'
            fill={style.stroke}
            stroke='#ffffff'
            strokeWidth='3'
            style={{ paintOrder: 'stroke' }}
          >
            {truncate(edge.item.name, 18)}
          </text>
        )}
      </g>
    )
  }

  const renderNode = (node) => {
    const text = statusLabel(node.name)
    const showCode = !sameWords(text, node.name)
    const dimmed = selected !== undefined && node.name !== selected
      && !graph.edges.some((e) => (e.from === selected && e.to === node.name) || (e.to === selected && e.from === node.name))
    const stroke = node.isEntry ? '#198754' : node.isDeadEnd ? '#fd7e14' : '#adb5bd'

    return (
      <g
        key={node.name}
        className='wf-diagram-node'
        opacity={dimmed ? 0.2 : 1}
        onClick={() => toggleSelected(node.name)}
      >
        <title>{`${text} (${node.name})\n${label('wf_node_in', { count: node.inCount })}, ${label('wf_node_out', { count: node.outCount })}`}</title>
        <rect
          x={node.x}
          y={node.y}
          width={NODE_W}
          height={NODE_H}
          rx='6'
          fill={node.name === selected ? '#e7f1ff' : '#ffffff'}
          stroke={node.name === selected ? '#0d6efd' : stroke}
          strokeWidth={node.name === selected ? 2 : 1.4}
        />
        <text
          x={node.x + NODE_W / 2}
          y={node.y + (showCode ? 17 : NODE_H / 2 + 4)}
          textAnchor='middle'
          fontSize='12'
          fill='#212529'
        >
          {truncate(text, 22)}
        </text>
        {showCode && (
          <text x={node.x + NODE_W / 2} y={node.y + 31} textAnchor='middle' fontSize='9' fill='#6c757d'>
            {truncate(node.name, 24)}
          </text>
        )}
      </g>
    )
  }

  const renderLegend = () => (
    <div className='wf-diagram-legend'>
      <span className='wf-legend-item'><i className='wf-legend-line wf-legend-default' />{label('wf_legend_default')}</span>
      <span className='wf-legend-item'><i className='wf-legend-line wf-legend-success' />{label('wf_legend_transition')}</span>
      <span className='wf-legend-item'><i className='wf-legend-line wf-legend-failed' />{label('wf_legend_failed')}</span>
      <span className='wf-legend-item'><i className='wf-legend-box wf-legend-entry' />{label('wf_legend_entry')}</span>
      <span className='wf-legend-item'><i className='wf-legend-box wf-legend-terminal' />{label('wf_legend_terminal')}</span>
    </div>
  )

  // Problems and observations are kept apart. Terminal and entry statuses are normal in a healthy
  // workflow, and listing them in the same block as the warnings made them read as findings.
  const renderReport = () => {
    const problems = issues.filter((issue) => issue.severity !== 'info')
    const observations = issues.filter((issue) => issue.severity === 'info')
    const worst = problems.some((issue) => issue.severity === 'error') ? 'error' : 'warning'

    return (
      <div className='wf-diagram-report'>
        <div className='wf-report-section'>
          <p className='wf-report-heading'>
            {label('wf_section_problems')}
            {problems.length > 0 && <span className={`wf-report-count wf-report-count-${worst}`}>{problems.length}</span>}
          </p>
          {problems.length === 0 ? (
            <div className='wf-issue wf-issue-ok'>
              <Icon name='IconCircleCheck' size={16} />
              <span>{label('wf_checks_ok')}</span>
            </div>
          ) : problems.map((issue) => (
            <div
              key={issue.key}
              className={`wf-issue wf-issue-${issue.severity}${issue.objectId ? ' wf-issue-clickable' : ''}`}
              onClick={() => issue.objectId && openItem(issue.objectId)}
            >
              <Icon name={SEVERITY_ICON[issue.severity]} size={16} />
              <span>{label(issue.code, issue.values)}</span>
            </div>
          ))}
        </div>

        {observations.length > 0 && (
          <div className='wf-report-section'>
            <p className='wf-report-heading'>{label('wf_section_about')}</p>
            {observations.map((issue) => (
              <p key={issue.key} className='wf-observation'>{label(issue.code, issue.values)}</p>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loading) return <Loading />

  if (failed) {
    return <div className='wf-diagram-empty'>{label('wf_load_failed')}</div>
  }

  if (!graph.transitionCount) {
    return <div className='wf-diagram-empty'>{label('wf_no_transitions')}</div>
  }

  return (
    <div className='wf-diagram'>
      <div className='wf-diagram-toolbar'>
        <span className='wf-diagram-counts'>
          {label('wf_count_statuses', { count: graph.statusCount })}
          {' · '}
          {label('wf_count_transitions', { count: graph.transitionCount })}
        </span>
        <span className='wf-diagram-toolbar-actions'>
          {selected !== undefined && (
            <button type='button' className='wf-diagram-btn' onClick={() => setState({ selected: undefined })}>
              {label('wf_clear_selection')}
            </button>
          )}
          <button type='button' className='wf-diagram-btn' onClick={() => setState({ showLabels: !showLabels })}>
            {label(showLabels ? 'wf_hide_labels' : 'wf_show_labels')}
          </button>
          <button type='button' className='wf-diagram-btn' onClick={fitToWidth}>{label('wf_zoom_fit')}</button>
          <button type='button' className='wf-diagram-btn' title={label('wf_zoom_out')} onClick={() => setState({ zoom: clampZoom(zoom - ZOOM_STEP) })}>
            <Icon name='IconMinus' size={14} />
          </button>
          <span className='wf-diagram-zoom-value'>{Math.round(zoom * 100)}%</span>
          <button type='button' className='wf-diagram-btn' title={label('wf_zoom_in')} onClick={() => setState({ zoom: clampZoom(zoom + ZOOM_STEP) })}>
            <Icon name='IconPlus' size={14} />
          </button>
        </span>
      </div>

      <div className='wf-diagram-canvas' ref={canvasRef}>
        <svg
          width={graph.width * zoom}
          height={graph.height * zoom}
          viewBox={`0 0 ${graph.width} ${graph.height}`}
          role='img'
          aria-label={label('wf_diagram')}
        >
          <defs>{renderMarkers()}</defs>
          <g>{graph.edges.map(renderEdge)}</g>
          <g>{graph.nodes.map(renderNode)}</g>
        </svg>
      </div>

      {renderLegend()}
      {renderReport()}
    </div>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(WorkFlowDiagram)
