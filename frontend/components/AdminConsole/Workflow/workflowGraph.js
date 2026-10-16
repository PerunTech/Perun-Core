import { normalizeRow, isTrue } from '../SvarogTables/svarogTableUtils'

// SVAROG_WORKFLOW_ITEM rows describe a state machine: every row is one
// ORIGINATING_STATUS to DESTINATION_STATUS transition with a FAILED_STATUS branch. These helpers
// turn the flat row list into a laid-out graph plus a list of consistency issues, so the automaton
// can be read as a diagram instead of a table of codes.

const ITEM_PREFIX = 'SVAROG_WORKFLOW_ITEM.'

export const NODE_W = 156
export const NODE_H = 42
const GAP_X = 96
const GAP_Y = 26
const PAD = 24
const DIP_BASE = 46
const DIP_STEP = 18
const DIP_VARIANTS = 4
// Under-routed edges anchor across the middle 64% of a node's bottom edge, never at one point.
const UNDER_INSET = 0.18
const UNDER_SPAN = 0.64

export const parseWorkflowItems = (rows) => (Array.isArray(rows) ? rows : []).map((row) => {
  const r = normalizeRow(ITEM_PREFIX, row)
  return {
    objectId: r.OBJECT_ID,
    name: r.WORKFLOW_ITEM_NAME || '',
    from: r.ORIGINATING_STATUS || '',
    to: r.DESTINATION_STATUS || '',
    failed: r.FAILED_STATUS || '',
    isDefault: isTrue(r.IS_DEFAULT_WF_ROUTE),
    defaultRule: r.DEFAULT_RULE || '',
    successRule: r.SUCCESS_RULE || '',
    failedRule: r.FAILED_RULE || '',
    permissionCode: r.PERMISSION_CODE || '',
  }
})

// APPROVED3 becomes "Approved3", NEW_OBJECT becomes "New object"
export const prettifyCode = (code) => {
  if (!code) return ''
  return code.charAt(0).toUpperCase() + code.slice(1).toLowerCase().replace(/_/g, ' ')
}

const LOOKS_LIKE_LABEL_CODE = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/i

// The schema's enumNames are a mix of plain English and raw label codes ("status.new"). Resolve the
// codes through intl where a label exists, and fall back to the prettified enum value rather than
// showing the caller a raw code.
export const makeStatusLabeller = (enumNameByCode, fmt) => (code) => {
  const raw = enumNameByCode && enumNameByCode[code]
  if (!raw) return prettifyCode(code)
  if (!LOOKS_LIKE_LABEL_CODE.test(raw)) return raw
  const translated = fmt(raw)
  return !translated || translated === raw ? prettifyCode(code) : translated
}

export const statusEnumNames = (schema) => {
  const props = (schema && schema.properties) || schema
  const field = props && props.ORIGINATING_STATUS
  const map = {}
  if (!field || !Array.isArray(field.enum)) return map
  field.enum.forEach((code, idx) => {
    const name = field.enumNames && field.enumNames[idx]
    if (name) map[code] = name
  })
  return map
}

// Shortest number of hops from each status to a terminal status. Used to pick where to start
// walking a cyclic workflow: the status you have to travel furthest from to finish is the one that
// reads as the beginning of the workflow.
const distanceToTerminal = (nodeNames, edges) => {
  const incoming = {}
  const outDegree = {}
  nodeNames.forEach((n) => { incoming[n] = []; outDegree[n] = 0 })
  edges.forEach((e) => {
    if (e.from === e.to) return
    incoming[e.to].push(e.from)
    outDegree[e.from] += 1
  })

  const dist = {}
  const queue = nodeNames.filter((n) => outDegree[n] === 0)
  queue.forEach((n) => { dist[n] = 0 })
  for (let head = 0; head < queue.length; head++) {
    incoming[queue[head]].forEach((prev) => {
      if (dist[prev] === undefined) {
        dist[prev] = dist[queue[head]] + 1
        queue.push(prev)
      }
    })
  }
  // A status with no route to a terminal status sits on a closed loop; treat it as far from the end.
  nodeNames.forEach((n) => { if (dist[n] === undefined) dist[n] = Number.MAX_SAFE_INTEGER })
  return dist
}

// Workflows are routinely cyclic (REJECTED goes back to DRAFT), and a cycle would make longest-path
// layering push every node one layer further on each pass. A DFS marks the edges that close a cycle
// so layering can run over the remaining DAG; those edges are then drawn as the loops underneath.
// Which edge of a cycle gets cut depends on where the walk starts, so the roots are ordered to start
// at the statuses that read as the beginning of the workflow.
const findBackEdges = (nodeNames, edges) => {
  const WHITE = 0
  const GREY = 1
  const BLACK = 2

  const adjacent = {}
  const inDegree = {}
  nodeNames.forEach((n) => { adjacent[n] = []; inDegree[n] = 0 })
  edges.forEach((e) => {
    if (e.from === e.to) return
    adjacent[e.from].push(e)
    inDegree[e.to] += 1
  })

  const color = {}
  nodeNames.forEach((n) => { color[n] = WHITE })
  const back = new Set()

  // Entry statuses first so the walk starts where the workflow does; everything else afterwards to
  // cover components that are entirely cyclic.
  const dist = distanceToTerminal(nodeNames, edges)
  const byPreference = (a, b) => dist[b] - dist[a] || inDegree[a] - inDegree[b] || a.localeCompare(b)
  const roots = nodeNames.filter((n) => inDegree[n] === 0).sort(byPreference)
    .concat(nodeNames.slice().sort(byPreference))

  roots.forEach((root) => {
    if (color[root] !== WHITE) return
    color[root] = GREY
    // Iterative DFS, so a large workflow cannot blow the call stack.
    const stack = [{ node: root, idx: 0 }]
    while (stack.length) {
      const frame = stack[stack.length - 1]
      const outgoing = adjacent[frame.node]
      if (frame.idx >= outgoing.length) {
        color[frame.node] = BLACK
        stack.pop()
        continue
      }
      const edge = outgoing[frame.idx]
      frame.idx += 1
      if (color[edge.to] === GREY) {
        back.add(edge.key)
      } else if (color[edge.to] === WHITE) {
        color[edge.to] = GREY
        stack.push({ node: edge.to, idx: 0 })
      }
    }
  })

  return back
}

export const buildGraph = (items) => {
  const valid = items.filter((i) => i.from && i.to)

  const names = new Set()
  valid.forEach((i) => {
    names.add(i.from)
    names.add(i.to)
    if (i.failed) names.add(i.failed)
  })
  const nodeNames = Array.from(names).sort()

  const edges = []
  valid.forEach((i) => {
    edges.push({ key: `${i.objectId}-d`, item: i, from: i.from, to: i.to, kind: i.isDefault ? 'default' : 'success' })
    // A failed status equal to the destination would draw the same arrow twice; the validator
    // reports that case instead.
    if (i.failed && i.failed !== i.to) {
      edges.push({ key: `${i.objectId}-f`, item: i, from: i.from, to: i.failed, kind: 'failed' })
    }
  })

  // Longest-path layering over the acyclic part of the graph.
  const backEdges = findBackEdges(nodeNames, edges)
  const layer = {}
  nodeNames.forEach((n) => { layer[n] = 0 })
  const chainable = edges.filter((e) => e.from !== e.to && !backEdges.has(e.key))
  for (let pass = 0; pass < nodeNames.length; pass++) {
    let changed = false
    chainable.forEach((e) => {
      if (layer[e.to] < layer[e.from] + 1) {
        layer[e.to] = layer[e.from] + 1
        changed = true
      }
    })
    if (!changed) break
  }

  const layers = []
  nodeNames.forEach((n) => {
    if (!layers[layer[n]]) layers[layer[n]] = []
    layers[layer[n]].push(n)
  })
  for (let i = 0; i < layers.length; i++) {
    if (!layers[i]) layers[i] = []
  }

  // Single barycenter pass, left to right, to keep edge crossings down.
  const row = {}
  layers.forEach((layerNodes, li) => {
    if (li > 0) {
      const bary = {}
      layerNodes.forEach((n) => {
        const parents = edges.filter((e) => e.to === n && layer[e.from] < li).map((e) => row[e.from])
        bary[n] = parents.length ? parents.reduce((a, b) => a + b, 0) / parents.length : Number.MAX_SAFE_INTEGER
      })
      layerNodes.sort((a, b) => bary[a] - bary[b] || a.localeCompare(b))
    }
    layerNodes.forEach((n, idx) => { row[n] = idx })
  })

  const pos = {}
  nodeNames.forEach((n) => {
    pos[n] = { x: PAD + layer[n] * (NODE_W + GAP_X), y: PAD + row[n] * (NODE_H + GAP_Y) }
  })

  const outCount = {}
  const inCount = {}
  nodeNames.forEach((n) => { outCount[n] = 0; inCount[n] = 0 })
  valid.forEach((i) => { outCount[i.from] += 1 })
  edges.forEach((e) => { inCount[e.to] += 1 })

  const nodes = nodeNames.map((n) => ({
    name: n,
    x: pos[n].x,
    y: pos[n].y,
    inCount: inCount[n],
    outCount: outCount[n],
    isEntry: inCount[n] === 0,
    isDeadEnd: outCount[n] === 0,
  }))

  // Self loops and anything not moving to a later layer are routed underneath the nodes. If they all
  // met at the bottom centre, a status with both a self loop and an incoming rework edge (DRAFT in a
  // typical workflow) would have them cross each other right on the node border. Give every one its
  // own anchor along the bottom edge instead, ordered by where its other end sits, so they arrive in
  // the same left to right order as the statuses they come from and stop crossing.
  const routesUnder = (e) => e.from === e.to || pos[e.to].x <= pos[e.from].x

  const endpoints = {}
  nodeNames.forEach((n) => { endpoints[n] = [] })
  edges.filter(routesUnder).forEach((e) => {
    // A self loop touches one node twice, so nudge its two keys apart to take adjacent slots.
    endpoints[e.from].push({ key: e.from === e.to ? pos[e.from].x - 1 : pos[e.to].x, edge: e, end: 'from' })
    endpoints[e.to].push({ key: e.from === e.to ? pos[e.to].x + 1 : pos[e.from].x, edge: e, end: 'to' })
  })

  const anchor = {}
  nodeNames.forEach((n) => {
    const slots = endpoints[n].sort((p, q) => p.key - q.key || p.edge.key.localeCompare(q.edge.key))
    slots.forEach((slot, idx) => {
      const t = slots.length === 1 ? 0.5 : idx / (slots.length - 1)
      anchor[`${slot.edge.key}:${slot.end}`] = pos[n].x + NODE_W * (UNDER_INSET + UNDER_SPAN * t)
    })
  })

  let dipIndex = 0
  let maxDip = 0
  const nextDip = () => {
    const dip = DIP_BASE + (dipIndex % DIP_VARIANTS) * DIP_STEP
    dipIndex += 1
    maxDip = Math.max(maxDip, dip)
    return dip
  }

  const laidOutEdges = edges.map((e) => {
    const a = pos[e.from]
    const b = pos[e.to]

    if (!routesUnder(e)) {
      const sx = a.x + NODE_W
      const sy = a.y + NODE_H / 2
      const tx = b.x
      const ty = b.y + NODE_H / 2
      const dx = Math.max(40, (tx - sx) / 2)
      return { ...e, path: `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`, lx: (sx + tx) / 2, ly: (sy + ty) / 2 - 7 }
    }

    const dip = nextDip()
    const sx = anchor[`${e.key}:from`]
    const sy = a.y + NODE_H
    const tx = anchor[`${e.key}:to`]
    const ty = b.y + NODE_H

    if (e.from === e.to) {
      // Bow the loop outwards past its own anchors so it reads as a loop, not a shallow dish.
      const bulge = Math.min(52, Math.max(22, (tx - sx) * 0.45))
      return { ...e, path: `M ${sx} ${sy} C ${sx - bulge} ${sy + dip}, ${tx + bulge} ${ty + dip}, ${tx} ${ty}`, lx: (sx + tx) / 2, ly: sy + dip * 0.85 }
    }

    // Lean both control points along the direction of travel. With them directly below their own
    // endpoints the curve leaves and arrives exactly vertically, so the arrowhead points straight up
    // no matter which side the edge came from; the lean makes the marker sit at the angle the curve
    // is visibly travelling at.
    const lean = Math.min(46, Math.max(14, Math.abs(tx - sx) * 0.12)) * (tx >= sx ? 1 : -1)
    return { ...e, path: `M ${sx} ${sy} C ${sx + lean} ${sy + dip}, ${tx - lean} ${ty + dip}, ${tx} ${ty}`, lx: (sx + tx) / 2, ly: Math.max(sy, ty) + dip * 0.8 }
  })

  const rowCount = layers.length ? Math.max(...layers.map((l) => l.length)) : 1
  const width = PAD * 2 + Math.max(0, layers.length - 1) * (NODE_W + GAP_X) + NODE_W
  const height = PAD * 2 + rowCount * NODE_H + Math.max(0, rowCount - 1) * GAP_Y + maxDip

  return { nodes, edges: laidOutEdges, width, height, statusCount: nodeNames.length, transitionCount: valid.length }
}

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 }

export const validateWorkflow = (items) => {
  const issues = []
  const valid = items.filter((i) => i.from && i.to)
  const nameOf = (i) => i.name || `#${i.objectId}`

  items.filter((i) => !i.from || !i.to).forEach((i) => {
    issues.push({ key: `incomplete-${i.objectId}`, severity: 'error', code: 'wf_issue_incomplete', values: { name: nameOf(i) }, objectId: i.objectId })
  })

  const byPair = {}
  valid.forEach((i) => {
    const k = `${i.from} ${i.to}`
    if (!byPair[k]) byPair[k] = []
    byPair[k].push(i)
  })
  Object.keys(byPair).filter((k) => byPair[k].length > 1).forEach((k) => {
    const [from, to] = k.split(' ')
    issues.push({ key: `duplicate-${k}`, severity: 'warning', code: 'wf_issue_duplicate', values: { from, to, count: byPair[k].length }, objectId: byPair[k][0].objectId })
  })

  const defaultsByOrigin = {}
  valid.filter((i) => i.isDefault).forEach((i) => {
    if (!defaultsByOrigin[i.from]) defaultsByOrigin[i.from] = []
    defaultsByOrigin[i.from].push(i)
  })
  Object.keys(defaultsByOrigin).filter((s) => defaultsByOrigin[s].length > 1).forEach((status) => {
    issues.push({ key: `multi-default-${status}`, severity: 'error', code: 'wf_issue_multiple_default', values: { status, count: defaultsByOrigin[status].length }, objectId: defaultsByOrigin[status][0].objectId })
  })

  valid.filter((i) => i.from === i.to).forEach((i) => {
    issues.push({ key: `self-${i.objectId}`, severity: 'warning', code: 'wf_issue_self_loop', values: { name: nameOf(i), status: i.from }, objectId: i.objectId })
  })

  valid.filter((i) => i.failed && i.failed === i.to).forEach((i) => {
    issues.push({ key: `failed-eq-dest-${i.objectId}`, severity: 'warning', code: 'wf_issue_failed_equals_destination', values: { name: nameOf(i), status: i.to }, objectId: i.objectId })
  })

  const origins = new Set(valid.map((i) => i.from))
  const targets = new Set()
  valid.forEach((i) => {
    targets.add(i.to)
    if (i.failed) targets.add(i.failed)
  })

  const entries = Array.from(origins).filter((s) => !targets.has(s)).sort()
  const terminals = Array.from(targets).filter((s) => !origins.has(s)).sort()

  // Having no entry status is not a defect: objects are created straight into a status, so the
  // status a workflow starts from normally also has a rework transition coming back into it.
  if (entries.length) {
    issues.push({ key: 'entries', severity: 'info', code: 'wf_issue_entry_statuses', values: { statuses: entries.join(', '), count: entries.length } })
  }
  if (terminals.length) {
    issues.push({ key: 'terminals', severity: 'info', code: 'wf_issue_terminal_statuses', values: { statuses: terminals.join(', '), count: terminals.length } })
  }

  return issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}
