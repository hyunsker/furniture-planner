import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Loader2, Share2, Check, RotateCw, Trash2, Settings } from 'lucide-react'
import { useProject } from './hooks/useProject'
import RoomFormModal from './components/RoomFormModal'
import AptSizeModal from './components/AptSizeModal'
import RoomDetailView, { type FurnitureItem } from './components/RoomDetailView'
import FurnitureSymbol from './components/FurnitureSymbol'
import type { Room, ShapeData } from './types'
import { getRoomPoints } from './types'
import { FURNITURE_LIBRARY, FURNITURE_CATEGORIES } from './lib/furniture-library'

/** Ray-casting point-in-polygon */
function pointInPoly(px: number, py: number, pts: { x: number; y: number }[]): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Find which room a canvas point (cx,cy) belongs to */
function findRoomAt(cx: number, cy: number, rooms: Room[]): Room | null {
  for (const room of [...rooms].reverse()) {
    const lx = cx - room.x_cm, ly = cy - room.y_cm
    const shape = room.shape_data ?? { type: 'rect' as const }
    if (shape.type === 'poly') {
      if (pointInPoly(lx, ly, shape.points)) return room
    } else {
      if (lx >= 0 && ly >= 0 && lx <= room.width_cm && ly <= room.height_cm) return room
    }
  }
  return null
}

function getShareCode() {
  return new URLSearchParams(window.location.search).get('code')
}

const snap  = (v: number, g: number) => Math.round(v / g) * g
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Force every wall segment to be perfectly horizontal or vertical.
 * Walks the path from the first point; each edge keeps its dominant axis and
 * inherits the other coordinate from the previous point. This removes the tiny
 * skews that make L/ㄷ rooms look like rhombi after hand-drawing or editing.
 */
function orthogonalize(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  if (pts.length < 2) return pts.map(p => ({ ...p }))
  const out = [{ x: pts[0].x, y: pts[0].y }]
  for (let i = 1; i < pts.length; i++) {
    const prev = out[i - 1]
    const cur = pts[i]
    const dx = cur.x - prev.x
    const dy = cur.y - prev.y
    if (Math.abs(dx) >= Math.abs(dy)) {
      out.push({ x: cur.x, y: prev.y }) // horizontal edge
    } else {
      out.push({ x: prev.x, y: cur.y }) // vertical edge
    }
  }
  return out
}

const SNAP_DIST_CM = 12  // snap if within 12cm

function computeEdgeSnap(
  rawX: number, rawY: number,
  rw: number, rh: number,
  draggingId: string,
  allRooms: Room[],
  aptW: number, aptH: number,
): { x: number; y: number; guideX: number | null; guideY: number | null } {
  type Cand = { val: number; guide: number }
  const xs: Cand[] = [{ val: 0, guide: 0 }, { val: aptW - rw, guide: aptW }]
  const ys: Cand[] = [{ val: 0, guide: 0 }, { val: aptH - rh, guide: aptH }]

  for (const o of allRooms) {
    if (o.id === draggingId) continue
    const ol = o.x_cm, or_ = o.x_cm + o.width_cm
    const ot = o.y_cm, ob  = o.y_cm + o.height_cm
    xs.push({ val: ol,       guide: ol  })   // align left edges
    xs.push({ val: or_,      guide: or_ })   // left of dragged = right of other
    xs.push({ val: ol - rw,  guide: ol  })   // right of dragged = left of other
    xs.push({ val: or_ - rw, guide: or_ })   // align right edges
    ys.push({ val: ot,       guide: ot  })
    ys.push({ val: ob,       guide: ob  })
    ys.push({ val: ot - rh,  guide: ot  })
    ys.push({ val: ob - rh,  guide: ob  })
  }

  let bestX = rawX, guideX: number | null = null, dxBest = SNAP_DIST_CM
  for (const c of xs) {
    const d = Math.abs(rawX - c.val)
    if (d < dxBest) { dxBest = d; bestX = c.val; guideX = c.guide }
  }
  let bestY = rawY, guideY: number | null = null, dyBest = SNAP_DIST_CM
  for (const c of ys) {
    const d = Math.abs(rawY - c.val)
    if (d < dyBest) { dyBest = d; bestY = c.val; guideY = c.guide }
  }
  return { x: bestX, y: bestY, guideX, guideY }
}

// Detect shape from wall points and return ShapeData

const ROOM_COLORS: Record<string, { border: string; fill: string; text: string }> = {
  blue:   { border: '#3b82f6', fill: '#eff6ff', text: '#1d4ed8' },
  green:  { border: '#10b981', fill: '#ecfdf5', text: '#065f46' },
  purple: { border: '#8b5cf6', fill: '#f5f3ff', text: '#5b21b6' },
  yellow: { border: '#f59e0b', fill: '#fffbeb', text: '#92400e' },
  cyan:   { border: '#06b6d4', fill: '#ecfeff', text: '#155e75' },
  orange: { border: '#f97316', fill: '#fff7ed', text: '#9a3412' },
  pink:   { border: '#ec4899', fill: '#fdf2f8', text: '#9d174d' },
}
const DEFAULT_COLOR = { border: '#64748b', fill: '#f8fafc', text: '#334155' }

// Unified wall line hierarchy (closed rooms + open walls share the same weight/color)
const WALL_COLOR = '#475569'
const WALL_W = 4.5      // px, normal
const WALL_W_SEL = 5.5  // px, when selected

type DragMember = { id: string; x0: number; y0: number }
type DragState = { id: string; ox: number; oy: number; lx: number; ly: number; x0: number; y0: number; members: DragMember[] } | null

const CANVAS_W = 820
const CANVAS_H = 600

export default function App() {
  const shareCode = getShareCode()
  const { project, rooms, loading, error, addRoom, updateRoom, deleteRoom, rotateRoom, updateApartment, undo, canUndo } = useProject(shareCode)

  const [selectedId,    setSelectedId]    = useState<string | null>(null)
  const [multiSel,      setMultiSel]      = useState<string[]>([])   // rooms picked for grouping
  const [multiMode,     setMultiMode]     = useState(false)          // mobile multi-select toggle
  const [drag,          setDrag]          = useState<DragState>(null)
  const [copied,        setCopied]        = useState(false)

  // ── Responsive: mobile / desktop view ──
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>(
    () => (typeof window !== 'undefined' && window.innerWidth < 768) ? 'mobile' : 'desktop'
  )
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [winSize, setWinSize] = useState(
    () => ({ w: typeof window !== 'undefined' ? window.innerWidth : 1200, h: typeof window !== 'undefined' ? window.innerHeight : 800 })
  )
  useEffect(() => {
    const onResize = () => setWinSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const isMobile = viewMode === 'mobile'
  const [showRoomForm,  setShowRoomForm]  = useState(false)
  const [presetShape,   setPresetShape]   = useState<'rect' | 'L' | null>(null)
  const [showAptModal,  setShowAptModal]  = useState(false)
  const [editingRoom,   setEditingRoom]   = useState<Room | null>(null)
  const [detailRoom,    setDetailRoom]    = useState<Room | null>(null)
  // Furniture is stored per-room in Supabase (rooms.furniture) so both partners see it.
  const roomFurniture: Record<string, FurnitureItem[]> = {}
  for (const r of rooms) roomFurniture[r.id] = r.furniture ?? []
  const saveFurniture = (roomId: string, items: FurnitureItem[]) => updateRoom(roomId, { furniture: items })

  // Furniture catalog & placement
  const [sidebarTab,    setSidebarTab]    = useState<'rooms' | 'furniture'>('rooms')
  const [furnitureCat,  setFurnitureCat]  = useState('거실')
  const [placingItem,   setPlacingItem]   = useState<{ typeId: string; name: string; w: number; h: number } | null>(null)
  const [placingCursor, setPlacingCursor] = useState<{ x: number; y: number } | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_customSize,    _setCustomSize]    = useState<{ w: string; h: string } | null>(null)

  // Draw-by-drag state
  type DrawState = { sx: number; sy: number; ex: number; ey: number } | null
  const [drawState,    setDrawState]    = useState<DrawState>(null)
  const [pendingPos,   setPendingPos]   = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [snapGuides,   setSnapGuides]   = useState<{ x: number | null; y: number | null }>({ x: null, y: null })

  // Landing page
  const [landingDismissed, setLandingDismissed] = useState(false)
  const [shareInputVisible, setShareInputVisible] = useState(false)
  const [shareInputVal, setShareInputVal] = useState('')

  // Hover tooltip
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null)

  // Poly vertex editing
  const [hoveredVertexIdx, setHoveredVertexIdx] = useState<number | null>(null)
  const [hoveredEdgeIdx,   setHoveredEdgeIdx]   = useState<number | null>(null)
  const [vertexDrag, setVertexDrag] = useState<{
    roomId: string; idx: number; origPts: {x:number;y:number}[]
  } | null>(null)
  const [dragPolyPts, setDragPolyPts] = useState<{x:number;y:number}[] | null>(null)

  // Drawing tool: select (move/edit) · rect (drag rectangle) · wall (sketch lines)
  type Tool = 'select' | 'rect' | 'wall'
  const [tool,         setTool]         = useState<Tool>('select')
  const wallMode = tool === 'wall'
  const [wallPts,      setWallPts]      = useState<{x: number; y: number}[]>([])
  const [wallCursor,   setWallCursor]   = useState<{x: number; y: number; axis: 'h'|'v'} | null>(null)
  const [wallNearClose, setWallNearClose] = useState(false)  // cursor snapped to first point
  // Wall segment length inline edit (post-creation)
  const [editingWallLen, setEditingWallLen] = useState<{
    roomId: string; edgeIdx: number; currentLen: number; px: number; py: number
  } | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)

  const apt   = project ? { w: project.apt_w, h: project.apt_h } : { w: 1500, h: 1200 }
  // Available canvas area shrinks to the viewport on mobile so nothing overflows.
  // Reserve space for the header (~58px) and the bottom tool dock (~82px).
  const availW = isMobile ? winSize.w - 20 : CANVAS_W
  const availH = isMobile ? winSize.h - 58 - 82 - 12 : CANVAS_H
  const scale = Math.min(availW / apt.w, availH / apt.h, isMobile ? 1.4 : 1.8)
  const cW    = apt.w * scale
  const cH    = apt.h * scale

  // ── Wall drawing ──────────────────────────────────────────────────────────
  // Finish drawing walls. If the path is closed → filled room (poly).
  // If it stays open (lines don't meet) → open walls (polyline). Both are saved.
  const finishWalls = useCallback((pts: {x: number; y: number}[], roomCount: number, addRoomFn: typeof addRoom, forceClosed?: boolean) => {
    // Deduplicate consecutive identical/very-close points
    const deduped: {x: number; y: number}[] = []
    for (const p of pts) {
      const prev = deduped[deduped.length - 1]
      if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 5) deduped.push(p)
    }
    if (deduped.length < 2) { setWallPts([]); setWallCursor(null); setWallNearClose(false); return }

    const first = deduped[0]
    const last = deduped[deduped.length - 1]
    const closing = Math.hypot(last.x - first.x, last.y - first.y) < 25
    const isClosed = forceClosed || (closing && deduped.length >= 4)

    // If closed, drop the duplicate closing point
    let shapePts = deduped
    if (isClosed && closing) shapePts = deduped.slice(0, -1)

    // Snap every wall to be perfectly horizontal/vertical
    shapePts = orthogonalize(shapePts).map(p => ({ x: snap(p.x, 5), y: snap(p.y, 5) }))

    const xs = shapePts.map(p => p.x), ys = shapePts.map(p => p.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const w = Math.max(maxX - minX, 1), h = Math.max(maxY - minY, 1)

    const normalizedPts = shapePts.map(p => ({
      x: Math.round(p.x - minX),
      y: Math.round(p.y - minY),
    }))

    const shapeData: ShapeData = (isClosed && shapePts.length >= 3)
      ? { type: 'poly', points: normalizedPts }
      : { type: 'polyline', points: normalizedPts }

    const defaultNames = ['거실', '안방', '작은방', '주방', '욕실', '드레스룸', '서재']
    const name = (shapeData.type === 'polyline' ? '벽 ' : '') + (defaultNames[roomCount] ?? `방 ${roomCount + 1}`)
    addRoomFn(name, snap(w, 5), snap(h, 5), shapeData, snap(minX, 5), snap(minY, 5))
    setWallPts([])
    setWallCursor(null)
    setWallNearClose(false)
  }, [])

  // Renormalize a room's polygon: recompute bbox so x/y/w/h stay tidy after edits
  const commitPolyShape = (
    room: Room,
    newPts: { x: number; y: number }[],
    type: 'poly' | 'polyline',
  ) => {
    const xs = newPts.map(p => p.x), ys = newPts.map(p => p.y)
    const minX = Math.min(...xs), minY = Math.min(...ys)
    const maxX = Math.max(...xs), maxY = Math.max(...ys)
    const norm = newPts.map(p => ({ x: Math.round(p.x - minX), y: Math.round(p.y - minY) }))
    updateRoom(room.id, {
      x_cm: snap(room.x_cm + minX, 5),
      y_cm: snap(room.y_cm + minY, 5),
      width_cm: Math.max(snap(maxX - minX, 5), 5),
      height_cm: Math.max(snap(maxY - minY, 5), 5),
      shape_data: { type, points: norm },
    })
  }

  // Change one wall's length while keeping all walls perfectly horizontal/vertical.
  // Moves the far endpoint along the edge axis and drags the connected perpendicular
  // wall with it (one-step cascade) so the shape never turns into a rhombus.
  const applyEdgeLength = (
    pts: { x: number; y: number }[],
    i: number,
    newLen: number,
    isOpen: boolean,
  ): { x: number; y: number }[] => {
    const n = pts.length
    const j = (i + 1) % n
    const a = pts[i], b = pts[j]
    const out = pts.map(p => ({ ...p }))
    const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)

    if (horizontal) {
      const sign = b.x - a.x >= 0 ? 1 : -1
      const newBx = a.x + sign * newLen
      const delta = newBx - b.x
      out[j] = { x: newBx, y: a.y }
      const k = (j + 1) % n
      const hasNext = isOpen ? j + 1 < n : k !== i
      if (hasNext) {
        const kIsVertical = Math.abs(pts[k].y - b.y) >= Math.abs(pts[k].x - b.x)
        if (kIsVertical) out[k] = { x: pts[k].x + delta, y: pts[k].y }
      }
    } else {
      const sign = b.y - a.y >= 0 ? 1 : -1
      const newBy = a.y + sign * newLen
      const delta = newBy - b.y
      out[j] = { x: a.x, y: newBy }
      const k = (j + 1) % n
      const hasNext = isOpen ? j + 1 < n : k !== i
      if (hasNext) {
        const kIsHorizontal = Math.abs(pts[k].x - b.x) >= Math.abs(pts[k].y - b.y)
        if (kIsHorizontal) out[k] = { x: pts[k].x, y: pts[k].y + delta }
      }
    }
    return out
  }

  // ── ESC / Enter / Backspace key ────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (placingItem) { setPlacingItem(null); setPlacingCursor(null); return }
        if (editingWallLen) { setEditingWallLen(null); return }
        if (multiMode || multiSel.length) { setMultiMode(false); setMultiSel([]); return }
        if (wallMode) { setTool('select'); setWallPts([]); setWallCursor(null) }
      }
      // Enter: finish walls (open or closed)
      if (e.key === 'Enter' && wallMode && wallPts.length >= 2) {
        e.preventDefault()
        finishWalls(wallPts, rooms.length, addRoom)
        return
      }
      // Backspace: undo last wall point while drawing
      if ((e.key === 'Backspace' || e.key === 'z' && (e.metaKey || e.ctrlKey)) && wallMode) {
        e.preventDefault()
        setWallPts(prev => prev.slice(0, -1))
        setWallCursor(null)
        setWallNearClose(false)
        return
      }
      // Global undo (⌘Z / Ctrl+Z) when not actively drawing walls
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !wallMode) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        undo()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [wallMode, editingWallLen, placingItem, wallPts, rooms.length, addRoom, finishWalls, undo, multiMode, multiSel.length])


  // ── Drag handlers ────────────────────────────────────────────────────────
  const roomPointerDown = useCallback((e: React.PointerEvent, room: Room) => {
    if (wallMode) return  // wall mode: clicks go to canvas onClick instead
    e.stopPropagation()
    if (!canvasRef.current) return

    // Multi-select mode: tapping/clicking toggles membership instead of dragging
    if (multiMode || e.shiftKey || e.metaKey || e.ctrlKey) {
      setMultiSel(prev => prev.includes(room.id) ? prev.filter(id => id !== room.id) : [...prev, room.id])
      setSelectedId(room.id)
      return
    }

    const rect = canvasRef.current.getBoundingClientRect()
    const cx = (e.clientX - rect.left) / scale
    const cy = (e.clientY - rect.top)  / scale
    // If this room belongs to a locked group, drag all members together
    const members: DragMember[] = (room.group_id
      ? rooms.filter(r => r.group_id === room.group_id)
      : [room]
    ).map(r => ({ id: r.id, x0: r.x_cm, y0: r.y_cm }))
    setDrag({ id: room.id, ox: cx - room.x_cm, oy: cy - room.y_cm, lx: room.x_cm, ly: room.y_cm, x0: room.x_cm, y0: room.y_cm, members })
    setSelectedId(room.id)
    setMultiSel([])
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }, [scale, wallMode, multiMode, rooms])

  const canvasPointerMove = useCallback((e: React.PointerEvent) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const cx = (e.clientX - rect.left) / scale
    const cy = (e.clientY - rect.top)  / scale

    // Wall mode: update preview cursor
    if (wallMode && wallPts.length > 0) {
      const from = wallPts[wallPts.length - 1]
      // Snap to first point when nearby (for closure)
      if (wallPts.length >= 3) {
        const first = wallPts[0]
        const distToFirst = Math.hypot(cx - first.x, cy - first.y)
        if (distToFirst < 60) {
          setWallCursor({ x: first.x, y: first.y, axis: 'h' })
          setWallNearClose(true)
          return
        }
      }
      setWallNearClose(false)
      const dx = cx - from.x, dy = cy - from.y
      const axis: 'h'|'v' = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
      setWallCursor(axis === 'h' ? { x: cx, y: from.y, axis } : { x: from.x, y: cy, axis })
      return
    }

    // Furniture placement: track cursor
    if (placingItem) {
      setPlacingCursor({ x: cx, y: cy })
      return
    }

    if (vertexDrag) {
      e.preventDefault()
      const room = rooms.find(r => r.id === vertexDrag.roomId)
      if (!room) return
      const pts = vertexDrag.origPts
      const idx = vertexDrag.idx
      const n = pts.length
      const isOpen = room.shape_data?.type === 'polyline'

      // Allow dragging beyond the current bbox (room can grow); bbox is re-tightened on release
      let lx = clamp(cx, 0, apt.w) - room.x_cm
      let ly = clamp(cy, 0, apt.h) - room.y_cm

      // Align to the two adjacent vertices so both touching walls stay perfectly H/V
      const prevNb = idx - 1 >= 0 ? pts[idx - 1] : (!isOpen ? pts[n - 1] : null)
      const nextNb = idx + 1 < n ? pts[idx + 1] : (!isOpen ? pts[0] : null)
      const neighbors = [prevNb, nextNb].filter(Boolean) as { x: number; y: number }[]

      const ALIGN = 28  // cm – snap onto a neighbour's row/column for clean right angles
      // pick the closest neighbour x / y within threshold
      let bestDX = ALIGN, bestDY = ALIGN
      for (const nb of neighbors) {
        if (Math.abs(lx - nb.x) < bestDX) { bestDX = Math.abs(lx - nb.x); lx = nb.x }
        if (Math.abs(ly - nb.y) < bestDY) { bestDY = Math.abs(ly - nb.y); ly = nb.y }
      }

      const moved = { x: snap(lx, 5), y: snap(ly, 5) }
      const newPts = pts.map((p, i) => (i === idx ? moved : { ...p }))
      setDragPolyPts(newPts)
      return
    }

    if (drag) {
      e.preventDefault()
      const room = rooms.find(r => r.id === drag.id)
      if (!room) return
      const rawX = clamp(cx - drag.ox, 0, apt.w - room.width_cm)
      const rawY = clamp(cy - drag.oy, 0, apt.h - room.height_cm)
      const { x: nx, y: ny, guideX, guideY } = computeEdgeSnap(
        rawX, rawY, room.width_cm, room.height_cm, drag.id, rooms, apt.w, apt.h
      )
      setSnapGuides({ x: guideX, y: guideY })
      setDrag(d => d ? { ...d, lx: nx, ly: ny } : null)
    } else if (drawState) {
      e.preventDefault()
      setDrawState(d => d ? { ...d, ex: clamp(cx, 0, apt.w), ey: clamp(cy, 0, apt.h) } : null)
    }
  }, [drag, drawState, rooms, scale, apt, vertexDrag, wallMode, wallPts, placingItem])

  const canvasPointerUp = useCallback(() => {
    setSnapGuides({ x: null, y: null })
    if (vertexDrag && dragPolyPts) {
      const vr = rooms.find(r => r.id === vertexDrag.roomId)
      if (vr) {
        const vType = vr.shape_data?.type === 'polyline' ? 'polyline' : 'poly'
        commitPolyShape(vr, dragPolyPts, vType)
      }
      setVertexDrag(null)
      setDragPolyPts(null)
      return
    }
    if (drag) {
      const dx = drag.lx - drag.x0
      const dy = drag.ly - drag.y0
      if (drag.members.length > 1) {
        for (const m of drag.members) updateRoom(m.id, { x_cm: m.x0 + dx, y_cm: m.y0 + dy })
      } else {
        updateRoom(drag.id, { x_cm: drag.lx, y_cm: drag.ly })
      }
      setDrag(null)
    } else if (drawState) {
      const w = Math.abs(drawState.ex - drawState.sx)
      const h = Math.abs(drawState.ey - drawState.sy)
      if (w > 20 && h > 20) {
        const x = Math.min(drawState.sx, drawState.ex)
        const y = Math.min(drawState.sy, drawState.ey)
        setPendingPos({
          x: snap(x, 5), y: snap(y, 5),
          w: snap(w, 5), h: snap(h, 5),
        })
        setShowRoomForm(true)
      }
      setDrawState(null)
    }
  }, [drag, drawState, updateRoom, vertexDrag, dragPolyPts, rooms])

  // ── Grouping (lock rooms to move together) ─────────────────────────────────
  function lockGroup() {
    if (multiSel.length < 2) return
    const gid = `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    for (const id of multiSel) updateRoom(id, { group_id: gid })
    setMultiSel([])
    setMultiMode(false)
  }
  function unlockGroup(gid: string | null | undefined) {
    if (!gid) return
    for (const r of rooms.filter(x => x.group_id === gid)) updateRoom(r.id, { group_id: null })
  }

  // ── Share ─────────────────────────────────────────────────────────────────
  async function handleShare() {
    if (!project) return
    const url = `${window.location.origin}${window.location.pathname}?code=${project.share_code}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Landing page ──────────────────────────────────────────────────────────
  const showLanding = !loading && !shareCode && rooms.length === 0 && !landingDismissed && !wallMode

  if (showLanding) return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <style>{`
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(24px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) }
          50%       { transform: translateY(-8px) }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center }
          100% { background-position: 200% center }
        }
        .landing-fade-1 { animation: fade-up 0.6s ease both 0.1s }
        .landing-fade-2 { animation: fade-up 0.6s ease both 0.25s }
        .landing-fade-3 { animation: fade-up 0.6s ease both 0.4s }
        .landing-fade-4 { animation: fade-up 0.6s ease both 0.55s }
        .landing-float  { animation: float 3.5s ease-in-out infinite }
      `}</style>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', padding: '18px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11, background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
              <rect x="3" y="3" width="16" height="20" rx="2.5" fill="white" fillOpacity="0.9"/>
              <rect x="21" y="3" width="16" height="14" rx="2.5" fill="white" fillOpacity="0.5"/>
              <rect x="3" y="25" width="16" height="12" rx="2.5" fill="white" fillOpacity="0.5"/>
              <rect x="21" y="19" width="16" height="18" rx="2.5" fill="white" fillOpacity="0.7"/>
            </svg>
          </div>
          <span style={{ color: 'white', fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px' }}>집 배치도</span>
        </div>
        <button
          onClick={() => setShareInputVisible(v => !v)}
          style={{
            marginLeft: 'auto', color: 'rgba(255,255,255,0.5)', fontSize: 13,
            background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10,
            padding: '7px 16px', cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.color = 'white'; (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.4)' }}
          onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)' }}
        >
          공유 코드로 불러오기
        </button>
      </nav>

      {shareInputVisible && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 0', background: 'rgba(0,0,0,0.2)' }}>
          <input
            autoFocus value={shareInputVal}
            onChange={e => setShareInputVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && shareInputVal.trim()) window.location.search = `?code=${shareInputVal.trim()}` }}
            placeholder="공유 코드 입력..."
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 10, padding: '8px 14px', color: 'white', fontSize: 13, outline: 'none', width: 220,
            }}
          />
          <button
            onClick={() => { if (shareInputVal.trim()) window.location.search = `?code=${shareInputVal.trim()}` }}
            style={{
              background: '#6366f1', color: 'white', border: 'none', borderRadius: 10,
              padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >불러오기</button>
        </div>
      )}

      {/* Hero */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 32px', gap: 64, flexWrap: 'wrap' }}>

        {/* Floor plan illustration */}
        <div className="landing-float landing-fade-1" style={{ position: 'relative' }}>
          {/* Glow */}
          <div style={{
            position: 'absolute', inset: -24, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
            filter: 'blur(20px)',
          }}/>
          <div style={{
            width: 300, height: 220, borderRadius: 20,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(12px)',
            overflow: 'hidden', position: 'relative',
            boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
          }}>
            <svg viewBox="0 0 300 220" width="100%" height="100%" fill="none">
              <rect x="0" y="0" width="175" height="125" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.4)" strokeWidth="1.2"/>
              <rect x="175" y="0" width="125" height="100" fill="rgba(139,92,246,0.1)" stroke="rgba(139,92,246,0.35)" strokeWidth="1.2"/>
              <rect x="0" y="125" width="110" height="95" fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.3)" strokeWidth="1.2"/>
              <rect x="110" y="125" width="65" height="95" fill="rgba(245,158,11,0.08)" stroke="rgba(245,158,11,0.3)" strokeWidth="1.2"/>
              <rect x="175" y="100" width="125" height="120" fill="rgba(236,72,153,0.07)" stroke="rgba(236,72,153,0.28)" strokeWidth="1.2"/>
              {/* Sofa */}
              <rect x="16" y="52" width="70" height="22" rx="4" fill="rgba(99,102,241,0.25)" stroke="rgba(99,102,241,0.6)" strokeWidth="1"/>
              <rect x="16" y="47" width="70" height="9" rx="2" fill="rgba(99,102,241,0.35)" stroke="rgba(99,102,241,0.6)" strokeWidth="0.8"/>
              <rect x="16" y="52" width="9" height="22" rx="2" fill="rgba(99,102,241,0.3)" stroke="rgba(99,102,241,0.5)" strokeWidth="0.8"/>
              <rect x="77" y="52" width="9" height="22" rx="2" fill="rgba(99,102,241,0.3)" stroke="rgba(99,102,241,0.5)" strokeWidth="0.8"/>
              {/* TV */}
              <rect x="16" y="14" width="98" height="11" rx="2" fill="rgba(99,102,241,0.2)" stroke="rgba(99,102,241,0.5)" strokeWidth="0.8"/>
              {/* Bed */}
              <rect x="186" y="12" width="100" height="68" rx="4" fill="rgba(139,92,246,0.2)" stroke="rgba(139,92,246,0.55)" strokeWidth="1"/>
              <rect x="191" y="17" width="42" height="24" rx="3" fill="rgba(139,92,246,0.3)" stroke="rgba(139,92,246,0.5)" strokeWidth="0.8"/>
              <rect x="242" y="17" width="39" height="24" rx="3" fill="rgba(139,92,246,0.3)" stroke="rgba(139,92,246,0.5)" strokeWidth="0.8"/>
              {/* Dining table */}
              <rect x="20" y="148" width="60" height="42" rx="3" fill="rgba(16,185,129,0.15)" stroke="rgba(16,185,129,0.45)" strokeWidth="1"/>
              <ellipse cx="10" cy="169" rx="8" ry="12" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.35)" strokeWidth="0.8"/>
              <ellipse cx="90" cy="169" rx="8" ry="12" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.35)" strokeWidth="0.8"/>
              <ellipse cx="50" cy="138" rx="12" ry="8" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.35)" strokeWidth="0.8"/>
              <ellipse cx="50" cy="200" rx="12" ry="8" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.35)" strokeWidth="0.8"/>
              {/* Labels */}
              <text x="10" y="11" fontSize="7.5" fill="rgba(165,180,252,0.8)" fontWeight="600">거실</text>
              <text x="178" y="11" fontSize="7.5" fill="rgba(196,181,253,0.8)" fontWeight="600">안방</text>
              <text x="4" y="136" fontSize="7.5" fill="rgba(110,231,183,0.8)" fontWeight="600">주방</text>
              <text x="114" y="136" fontSize="7.5" fill="rgba(253,186,116,0.8)" fontWeight="600">욕실</text>
              <text x="178" y="111" fontSize="7.5" fill="rgba(249,168,212,0.8)" fontWeight="600">작은방</text>
            </svg>
          </div>
        </div>

        {/* Text content */}
        <div style={{ maxWidth: 420 }}>
          <div className="landing-fade-1" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 99,
            background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
            marginBottom: 20,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#818cf8' }}/>
            <span style={{ color: '#a5b4fc', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px' }}>가구 배치 플래너</span>
          </div>

          <h1 className="landing-fade-2" style={{
            fontSize: 42, fontWeight: 800, lineHeight: 1.15, marginBottom: 16,
            letterSpacing: '-1px', color: 'white',
          }}>
            우리집 가구 배치,<br/>
            <span style={{
              background: 'linear-gradient(90deg, #818cf8, #c084fc)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>직접 해보세요</span>
          </h1>

          <p className="landing-fade-3" style={{
            color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.7, marginBottom: 36,
          }}>
            실제 치수로 방을 그리고 소파·침대·식탁을<br/>
            직접 배치해보세요. 링크 하나로 가족과 함께.
          </p>

          <div className="landing-fade-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => setLandingDismissed(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '16px 28px', borderRadius: 16,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(99,102,241,0.5)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(99,102,241,0.4)' }}
            >
              <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
                <rect x="3" y="3" width="16" height="20" rx="2.5" stroke="white" strokeWidth="2"/>
                <rect x="21" y="3" width="16" height="14" rx="2.5" stroke="white" strokeWidth="2" strokeOpacity="0.6"/>
                <rect x="3" y="25" width="16" height="12" rx="2.5" stroke="white" strokeWidth="2" strokeOpacity="0.6"/>
                <rect x="21" y="19" width="16" height="18" rx="2.5" stroke="white" strokeWidth="2" strokeOpacity="0.8"/>
              </svg>
              새 프로젝트 시작하기
            </button>
            <button
              onClick={() => { setLandingDismissed(true); setTool('wall') }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '14px 28px', borderRadius: 16,
                background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.color = 'white' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)' }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <path d="M3 17L17 3M3 3h4M3 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="17" cy="3" r="2" fill="currentColor"/>
                <circle cx="3" cy="17" r="2" fill="currentColor"/>
              </svg>
              선으로 직접 그리기
            </button>
          </div>

          {/* Feature pills */}
          <div className="landing-fade-4" style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap' }}>
            {[
              { icon: '📐', text: '실측 치수 입력' },
              { icon: '🪑', text: '가구 15+ 종류' },
              { icon: '👫', text: '실시간 공유' },
              { icon: '✏️', text: '자유 형태 그리기' },
            ].map(f => (
              <div key={f.text} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 99,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <span style={{ fontSize: 12 }}>{f.icon}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 500 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  // ── Room detail view ──────────────────────────────────────────────────────
  if (detailRoom) {
    const liveRoom = rooms.find(r => r.id === detailRoom.id) ?? detailRoom
    return (
      <RoomDetailView
        room={liveRoom}
        items={roomFurniture[liveRoom.id] ?? []}
        onItemsChange={items => saveFurniture(liveRoom.id, items)}
        onBack={() => setDetailRoom(null)}
      />
    )
  }

  // ── Loading / Error ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)' }}>
      {/* Logo */}
      <div style={{ animation: 'pulse 1.8s ease-in-out infinite' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 22,
          background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(8px)',
          border: '1.5px solid rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
            <rect x="3" y="3" width="16" height="20" rx="2.5" fill="white" fillOpacity="0.9"/>
            <rect x="21" y="3" width="16" height="14" rx="2.5" fill="white" fillOpacity="0.5"/>
            <rect x="3" y="25" width="16" height="12" rx="2.5" fill="white" fillOpacity="0.5"/>
            <rect x="21" y="19" width="16" height="18" rx="2.5" fill="white" fillOpacity="0.7"/>
          </svg>
        </div>
      </div>
      <p style={{ color: 'white', fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>집 배치도</p>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 40 }}>우리집 가구 배치 플래너</p>
      {/* Loading bar */}
      <div style={{ width: 140, height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', background: 'white', borderRadius: 99,
          animation: 'loading-bar 1.4s ease-in-out infinite',
        }}/>
      </div>
      <style>{`
        @keyframes loading-bar {
          0%   { width: 0%; margin-left: 0% }
          50%  { width: 60%; margin-left: 20% }
          100% { width: 0%; margin-left: 100% }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px) }
          to   { opacity: 1; transform: translateY(0) }
        }
      `}</style>
    </div>
  )

  if (false && loading) return (
    <div className="h-screen flex items-center justify-center bg-[#F4F5F7]">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <Loader2 className="animate-spin" size={26}/>
        <p className="text-sm">불러오는 중...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="h-screen flex items-center justify-center bg-[#F4F5F7]">
      <div className="text-center">
        <p className="text-gray-600 font-medium">{error}</p>
        <button onClick={() => window.history.replaceState(null, '', '/')}
          className="mt-4 text-indigo-500 text-sm hover:underline">
          새 프로젝트 시작
        </button>
      </div>
    </div>
  )

  const totalArea = rooms.reduce((s, r) => s + r.width_cm * r.height_cm, 0)
  const furnitureCount = Object.values(roomFurniture).reduce((s, arr) => s + arr.length, 0)

  return (
    <div className="h-screen flex bg-[#F4F5F7] overflow-hidden">

      {/* Mobile drawer backdrop */}
      {isMobile && mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 90 }}
        />
      )}

      {/* ══ SIDEBAR ════════════════════════════════════════════════════════ */}
      <aside
        className="bg-white border-r border-gray-100 flex flex-col shadow-sm"
        style={isMobile ? {
          position: 'fixed', top: 0, bottom: 0, left: 0, width: 260, zIndex: 95,
          transform: mobileSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
        } : { width: 240, flexShrink: 0 }}
      >

        {/* Logo / Project name */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="7" height="9" rx="1" fill="white" fillOpacity="0.9"/>
                <rect x="11" y="2" width="7" height="6" rx="1" fill="white" fillOpacity="0.6"/>
                <rect x="2" y="13" width="7" height="5" rx="1" fill="white" fillOpacity="0.6"/>
                <rect x="11" y="10" width="7" height="8" rx="1" fill="white" fillOpacity="0.8"/>
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-gray-900 truncate">{project?.name ?? '평면도'}</p>
              <p className="text-[10px] text-gray-400">{apt.w} × {apt.h} cm</p>
            </div>
            {isMobile && (
              <button
                onClick={() => setMobileSidebarOpen(false)}
                title="닫기"
                className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-1.5">
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-gray-200 text-[11px] text-gray-500 hover:bg-gray-50 transition-colors"
            >
              {copied ? <Check size={11} className="text-green-500"/> : <Share2 size={11}/>}
              {copied ? '복사됨' : '공유'}
            </button>
            <button
              onClick={() => setShowAptModal(true)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-gray-200 text-[11px] text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <Settings size={11}/> 도면 크기
            </button>
          </div>
        </div>

        {/* Stats */}
        {rooms.length > 0 && (
          <div className="px-4 py-2.5 border-b border-gray-100 flex gap-3">
            <div className="text-center flex-1">
              <p className="text-base font-bold text-gray-800">{rooms.length}</p>
              <p className="text-[10px] text-gray-400">공간</p>
            </div>
            <div className="w-px bg-gray-100"/>
            <div className="text-center flex-1">
              <p className="text-base font-bold text-gray-800">{(totalArea / 10000).toFixed(1)}</p>
              <p className="text-[10px] text-gray-400">m²</p>
            </div>
            <div className="w-px bg-gray-100"/>
            <div className="text-center flex-1">
              <p className="text-base font-bold text-gray-800">{furnitureCount}</p>
              <p className="text-[10px] text-gray-400">가구</p>
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="px-3 pt-2 pb-1 flex gap-1">
          {(['rooms', 'furniture'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setSidebarTab(tab); if (tab === 'rooms') { setPlacingItem(null); setPlacingCursor(null) } }}
              className={`flex-1 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                sidebarTab === tab ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab === 'rooms' ? '🏠 공간' : '🪑 가구'}
            </button>
          ))}
        </div>

        {/* Rooms list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2" style={{ display: sidebarTab === 'rooms' ? 'block' : 'none' }}>
          {rooms.length === 0 ? (
            <p className="text-xs text-gray-400 px-2 py-3 leading-relaxed">
              아직 공간이 없습니다.<br/>아래 버튼으로 추가하세요.
            </p>
          ) : rooms.map(room => {
            const c = ROOM_COLORS[room.color] ?? DEFAULT_COLOR
            const fCount = (roomFurniture[room.id] ?? []).length
            const isSel = selectedId === room.id
            return (
              <div
                key={room.id}
                onClick={() => setSelectedId(isSel ? null : room.id)}
                className={`group flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl mb-0.5 cursor-pointer transition-all ${
                  isSel ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: c.border }}/>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-800 truncate">{room.name}</p>
                  <p className="text-[10px] text-gray-400">
                    {room.width_cm}×{room.height_cm}cm
                    {fCount > 0 && <span className="ml-1.5 text-indigo-400">가구 {fCount}개</span>}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); setDetailRoom(room) }}
                    title="가구 배치"
                    className="p-1 rounded-md hover:bg-indigo-100 text-gray-300 hover:text-indigo-500 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                      <rect x="2" y="9" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                      <rect x="12" y="5" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                      <rect x="12" y="12" width="6" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); rotateRoom(room.id) }}
                    title="회전"
                    className="p-1 rounded-md hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <RotateCw size={11}/>
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteRoom(room.id) }}
                    title="삭제"
                    className="p-1 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={11}/>
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Furniture catalog tab panel */}
        {sidebarTab === 'furniture' && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Placement mode banner */}
            {placingItem && (
              <div className="mx-2 mb-1 px-3 py-2 rounded-xl bg-indigo-500 text-white">
                <p className="text-[11px] font-semibold">📍 배치 중: {placingItem.name}</p>
                <p className="text-[10px] opacity-80">{placingItem.w}×{placingItem.h}cm · 방 위를 클릭하세요 · Esc 취소</p>
              </div>
            )}
            {/* Category pills */}
            <div className="flex gap-1 px-2 py-1 flex-wrap">
              {FURNITURE_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFurnitureCat(cat)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                    furnitureCat === cat ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >{cat}</button>
              ))}
            </div>
            {/* Furniture items */}
            <div className="px-2 pb-2">
              {FURNITURE_LIBRARY.filter(f => f.category === furnitureCat).map(fType => (
                <div key={fType.name} className="mb-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">{fType.name}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {fType.variants.map(variant => {
                      const isPlacing = placingItem?.typeId === variant.id && placingItem?.name === fType.name && placingItem?.w === variant.w && placingItem?.h === variant.h
                      return (
                        <button
                          key={variant.id + variant.label}
                          onClick={() => {
                            if (isPlacing) { setPlacingItem(null); setPlacingCursor(null) }
                            else { setPlacingItem({ typeId: variant.id, name: fType.name, w: variant.w, h: variant.h }); if (isMobile) setMobileSidebarOpen(false) }
                          }}
                          className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                            isPlacing ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300' : 'border-gray-100 bg-white hover:border-indigo-200 hover:bg-indigo-50'
                          }`}
                        >
                          {/* Mini SVG preview */}
                          <svg width="44" height="32" style={{ overflow: 'visible' }}>
                            {(() => {
                              const aspect = variant.w / variant.h
                              const pw = aspect >= 1 ? 40 : 40 * aspect
                              const ph = aspect < 1  ? 28 : 28 / aspect
                              return (
                                <g transform={`translate(${(44 - pw) / 2}, ${(32 - ph) / 2})`}>
                                  <FurnitureSymbol type={variant.id} w={pw} h={ph} stroke="#6366f1" strokeWidth={1.2}/>
                                </g>
                              )
                            })()}
                          </svg>
                          <span className="text-[10px] text-gray-600 font-medium leading-tight text-center">{variant.label}</span>
                          <span className="text-[9px] text-gray-400">{variant.w}×{variant.h}cm</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Door hint (rooms tab only) */}
        {sidebarTab === 'rooms' && rooms.length > 0 && (
          <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-[10px] text-amber-700 leading-relaxed">
              🚪 <strong>출입문</strong>은 방을 더블클릭하면<br/>상세보기에서 추가할 수 있어요.
            </p>
          </div>
        )}

        {/* Add room button + wall draw button */}
        <div className="p-3 border-t border-gray-100 flex flex-col gap-2">
          {/* Shape preset label */}
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-0.5">방 모양 선택</div>
          <div className="grid grid-cols-3 gap-1.5">
            {/* 사각형 preset */}
            <button
              onClick={() => { setEditingRoom(null); setPresetShape('rect'); setShowRoomForm(true) }}
              className="flex flex-col items-center gap-1 py-2 rounded-lg border border-gray-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-gray-600 hover:text-indigo-600 transition-all"
            >
              <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
                <rect x="1" y="1" width="20" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
              </svg>
              <span className="text-[10px] font-medium">사각형</span>
            </button>
            {/* ㄱ자 preset */}
            <button
              onClick={() => { setEditingRoom(null); setPresetShape('L'); setShowRoomForm(true) }}
              className="flex flex-col items-center gap-1 py-2 rounded-lg border border-gray-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-gray-600 hover:text-indigo-600 transition-all"
            >
              <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
                <polygon points="1,1 13,1 13,8 21,8 21,17 1,17" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
              </svg>
              <span className="text-[10px] font-medium">ㄱ자형</span>
            </button>
            {/* 선으로 그리기 */}
            <button
              onClick={() => { setTool(t => t === 'wall' ? 'select' : 'wall'); setWallPts([]); setWallCursor(null); setSelectedId(null); if (isMobile) setMobileSidebarOpen(false) }}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg border transition-all ${
                wallMode
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-600'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
                <path d="M2 16 L8 2 L14 10 L20 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="2" cy="16" r="2" fill="currentColor"/>
                <circle cx="20" cy="4" r="2" fill="currentColor"/>
              </svg>
              <span className="text-[10px] font-medium">{wallMode ? '그리기중' : '선으로 그리기'}</span>
            </button>
          </div>
          {wallMode && (
            <div className="text-[10px] text-indigo-500 text-center bg-indigo-50 rounded-lg py-1.5 px-2 leading-relaxed">
              클릭으로 꼭짓점 추가<br/>↩ Enter = 완성 (열린 선도 OK) · Esc 취소
            </div>
          )}
        </div>
      </aside>

      {/* ══ MAIN CANVAS AREA ═══════════════════════════════════════════════ */}
      <main
        className={`flex-1 overflow-auto flex flex-col items-center ${isMobile ? 'justify-center p-2' : 'justify-center p-8'}`}
        style={isMobile ? { paddingBottom: 90 } : undefined}
      >

        <div>
          {/* Canvas header */}
          <div className="flex items-center justify-between mb-3 px-1 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {isMobile && (
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  title="메뉴 열기"
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 shrink-0"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
              <span className="text-[13px] font-semibold text-gray-600 shrink-0">전체 도면</span>
              {!isMobile && (
                <span className="text-[11px] text-gray-400">
                  {(apt.w / 100).toFixed(1)}m × {(apt.h / 100).toFixed(1)}m
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Mobile / Desktop view toggle */}
              <button
                onClick={() => { setViewMode(m => m === 'mobile' ? 'desktop' : 'mobile'); setMobileSidebarOpen(false) }}
                title={isMobile ? '데스크탑 보기로' : '모바일 보기로'}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                {isMobile ? '💻 데스크탑' : '📱 모바일'}
              </button>
              <button
                onClick={() => undo()}
                disabled={!canUndo}
                title="되돌리기 (⌘Z)"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border ${
                  canUndo
                    ? 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 cursor-pointer'
                    : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <path d="M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 8h9a5 5 0 0 1 0 10H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {!isMobile && '되돌리기'}
              </button>
              {!isMobile && (
                <button
                  onClick={() => { setMultiMode(m => !m); setMultiSel([]); setTool('select') }}
                  title="여러 방 선택해서 묶기"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border ${
                    multiMode
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
                    <rect x="10" y="10" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
                  </svg>
                  다중선택
                </button>
              )}
              {!isMobile && (
                <span className="text-[11px] text-gray-400">
                  {wallMode ? '클릭 → 꼭짓점 · Esc 취소'
                    : multiMode ? '방을 눌러 여러 개 선택 → 함께 묶기'
                    : 'Shift+클릭 = 다중선택 · 드래그 = 이동'}
                </span>
              )}
            </div>
          </div>

            {/* Floor plan */}
            <div
              className="relative rounded-xl bg-white shadow-xl"
              style={{ width: cW, height: cH, border: '1.5px solid #e2e8f0' }}
            >
              {/* Grid SVG */}
              <svg
                className="absolute inset-0 pointer-events-none"
                width={cW} height={cH}
              >
                <defs>
                  <pattern id="fp-grid-sm" width={50 * scale} height={50 * scale} patternUnits="userSpaceOnUse">
                    <path d={`M ${50 * scale} 0 L 0 0 0 ${50 * scale}`} fill="none" stroke="#f1f5f9" strokeWidth="0.6"/>
                  </pattern>
                  <pattern id="fp-grid-lg" width={100 * scale} height={100 * scale} patternUnits="userSpaceOnUse">
                    <rect width={100 * scale} height={100 * scale} fill="url(#fp-grid-sm)"/>
                    <path d={`M ${100 * scale} 0 L 0 0 0 ${100 * scale}`} fill="none" stroke="#e2e8f0" strokeWidth="0.8"/>
                  </pattern>
                </defs>
                <rect width={cW} height={cH} fill="url(#fp-grid-lg)"/>

                {/* Rulers */}
                {Array.from({ length: Math.floor(apt.w / 100) + 1 }, (_, i) => i * 100).map(x => (
                  <text key={x} x={x * scale} y={10} fontSize={8} fill="#94a3b8" textAnchor="middle">{x}</text>
                ))}
                {Array.from({ length: Math.floor(apt.h / 100) + 1 }, (_, i) => i * 100).map(y => (
                  y > 0 && <text key={y} x={4} y={y * scale + 3} fontSize={8} fill="#94a3b8" textAnchor="start">{y}</text>
                ))}
              </svg>

              {/* ── Floating drawing toolbar (paint-app style) — desktop only ── */}
              <div
                onPointerDown={e => e.stopPropagation()}
                style={{
                  position: 'absolute', top: 10, left: 10, zIndex: 60,
                  display: isMobile ? 'none' : 'flex', flexDirection: 'column', gap: 4,
                  background: 'white', borderRadius: 12, padding: 5,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid #eef2ff',
                }}
              >
                {([
                  { id: 'select', label: '선택', icon: (
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <path d="M4 3l11 5-4.5 1.5L9 14 4 3z" fill="currentColor"/>
                    </svg>
                  )},
                  { id: 'rect', label: '사각형', icon: (
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <rect x="3" y="5" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
                    </svg>
                  )},
                  { id: 'wall', label: '선', icon: (
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <path d="M3 16L9 5l3 6 5-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="3" cy="16" r="1.8" fill="currentColor"/>
                      <circle cx="17" cy="7" r="1.8" fill="currentColor"/>
                    </svg>
                  )},
                ] as { id: Tool; label: string; icon: React.ReactNode }[]).map(t => {
                  const active = tool === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTool(t.id)
                        setWallPts([]); setWallCursor(null); setWallNearClose(false)
                        setSelectedId(null); setDrawState(null)
                      }}
                      title={t.label}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                        width: 46, padding: '6px 0', borderRadius: 8, cursor: 'pointer',
                        border: 'none',
                        background: active ? '#6366f1' : 'transparent',
                        color: active ? 'white' : '#64748b',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => { if (!active) (e.currentTarget.style.background = '#f1f5f9') }}
                      onMouseLeave={e => { if (!active) (e.currentTarget.style.background = 'transparent') }}
                    >
                      {t.icon}
                      <span style={{ fontSize: 9, fontWeight: 600 }}>{t.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Drag capture div */}
              <div
                ref={canvasRef}
                className="absolute inset-0"
                style={{ cursor: placingItem ? 'crosshair' : wallMode ? 'crosshair' : drag ? 'grabbing' : drawState ? 'crosshair' : 'default' }}
                onPointerMove={canvasPointerMove}
                onPointerUp={canvasPointerUp}
                onPointerLeave={canvasPointerUp}
                onClick={e => {
                  // Furniture placement
                  if (placingItem) {
                    const rect = canvasRef.current!.getBoundingClientRect()
                    const cx = (e.clientX - rect.left) / scale
                    const cy = (e.clientY - rect.top)  / scale
                    const room = findRoomAt(cx, cy, rooms)
                    if (room) {
                      const fw = placingItem.w, fh = placingItem.h
                      const lx = cx - room.x_cm, ly = cy - room.y_cm
                      const newItem: FurnitureItem = {
                        id: `f-${Date.now()}`,
                        typeId: placingItem.typeId,
                        label: placingItem.name,
                        x: snap(clamp(lx - fw / 2, 0, room.width_cm - fw), 5),
                        y: snap(clamp(ly - fh / 2, 0, room.height_cm - fh), 5),
                        w: fw, h: fh, rotation: 0,
                      }
                      saveFurniture(room.id, [...(roomFurniture[room.id] ?? []), newItem])
                    }
                    // Keep placement mode on for multiple placements, Esc to exit
                    return
                  }
                  if (wallMode) {
                    const rect = canvasRef.current!.getBoundingClientRect()
                    const cx = clamp((e.clientX - rect.left) / scale, 0, apt.w)
                    const cy = clamp((e.clientY - rect.top)  / scale, 0, apt.h)
                    // Close shape when near first point → filled room
                    if (wallNearClose && wallPts.length >= 3) {
                      finishWalls(wallPts, rooms.length, addRoom, true)
                      return
                    }
                    if (wallPts.length === 0) {
                      // First point
                      setWallPts([{ x: snap(cx, 5), y: snap(cy, 5) }])
                    } else {
                      // Use H/V-snapped cursor position directly (no modal)
                      const pt = wallCursor ?? { x: snap(cx, 5), y: snap(cy, 5) }
                      setWallPts(prev => [...prev, { x: snap(pt.x, 5), y: snap(pt.y, 5) }])
                    }
                    return
                  }
                  if (!drag && !drawState) setSelectedId(null)
                }}
                onDoubleClick={e => {
                  if (wallMode && wallPts.length >= 2) {
                    e.stopPropagation()
                    finishWalls(wallPts, rooms.length, addRoom)
                  }
                }}
                onPointerDown={e => {
                  if (wallMode) return       // wall mode uses onClick
                  if (tool !== 'rect') return // only the rectangle tool draws by drag
                  if (drag || drawState) return
                  const rect = canvasRef.current!.getBoundingClientRect()
                  const x = clamp((e.clientX - rect.left) / scale, 0, apt.w)
                  const y = clamp((e.clientY - rect.top)  / scale, 0, apt.h)
                  setDrawState({ sx: x, sy: y, ex: x, ey: y })
                  setSelectedId(null)
                  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
                }}
              >
                {rooms.map(room => {
                  const dragMem = drag?.members.find(m => m.id === room.id)
                  const isDragging = !!dragMem
                  const dragDX = drag ? drag.lx - drag.x0 : 0
                  const dragDY = drag ? drag.ly - drag.y0 : 0
                  const px  = (dragMem ? dragMem.x0 + dragDX : room.x_cm) * scale
                  const py  = (dragMem ? dragMem.y0 + dragDY : room.y_cm) * scale
                  const pw  = room.width_cm  * scale
                  const ph  = room.height_cm * scale
                  const isSel = selectedId === room.id
                  const inMulti = multiSel.includes(room.id)
                  const isGrouped = !!room.group_id
                  const c   = ROOM_COLORS[room.color] ?? DEFAULT_COLOR
                  const furniture = roomFurniture[room.id] ?? []

                  const shape = room.shape_data ?? { type: 'rect' as const }

                  // ── Open walls (polyline): rendered as architectural wall lines ──
                  if (shape.type === 'polyline') {
                    const PAD = 16  // px padding so thin lines stay clickable
                    const ptsPx = shape.points.map(p => ({ x: p.x * scale + PAD, y: p.y * scale + PAD }))
                    const pathStr = ptsPx.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                    const hi = isSel || inMulti
                    const wallColor = inMulti ? '#f59e0b' : isSel ? '#6366f1' : WALL_COLOR
                    const wallPx = hi ? WALL_W_SEL : WALL_W
                    return (
                      <div
                        key={room.id}
                        onPointerDown={e => roomPointerDown(e, room)}
                        onClick={e => { e.stopPropagation(); setSelectedId(room.id) }}
                        onMouseEnter={() => setHoveredRoomId(room.id)}
                        onMouseLeave={() => setHoveredRoomId(null)}
                        style={{
                          position: 'absolute',
                          left: px - PAD, top: py - PAD,
                          width: pw + PAD * 2, height: ph + PAD * 2,
                          cursor: isDragging ? 'grabbing' : 'grab',
                          zIndex: isDragging ? 20 : isSel ? 10 : 2,
                          userSelect: 'none',
                        }}
                      >
                        <svg width={pw + PAD * 2} height={ph + PAD * 2} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
                          {/* fat transparent hit area */}
                          <path d={pathStr} fill="none" stroke="transparent" strokeWidth={14} strokeLinecap="round"/>
                          {/* visible wall */}
                          <path d={pathStr} fill="none" stroke={wallColor} strokeWidth={wallPx}
                            strokeLinecap="round" strokeLinejoin="round"/>
                          {/* endpoint caps */}
                          {ptsPx.map((p, i) => (
                            <circle key={i} cx={p.x} cy={p.y} r={isSel ? 3 : 2.5} fill="white" stroke={wallColor} strokeWidth={1.5}/>
                          ))}
                        </svg>
                        {(isGrouped || inMulti) && (
                          <div style={{
                            position: 'absolute', left: PAD - 2, top: PAD - 2,
                            fontSize: 13, lineHeight: 1, pointerEvents: 'none', zIndex: 30,
                            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))',
                          }}>{inMulti ? '☑️' : '🔒'}</div>
                        )}
                        {hoveredRoomId === room.id && !drag && (
                          <div style={{
                            position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                            marginBottom: 6, background: '#1e293b', color: 'white', fontSize: 11, fontWeight: 600,
                            padding: '4px 9px', borderRadius: 6, pointerEvents: 'none', whiteSpace: 'nowrap',
                            zIndex: 200, boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                          }}>{room.name}</div>
                        )}
                      </div>
                    )
                  }

                  const clipId = `clip-${room.id}`
                  const hi = isSel || inMulti
                  const borderColor = inMulti ? '#f59e0b' : isSel ? '#6366f1' : WALL_COLOR
                  const wallPxClosed = hi ? WALL_W_SEL : WALL_W
                  const swCm = wallPxClosed / scale  // wall stroke-width in cm for viewBox
                  const furnSwCm = 1.5 / scale       // thin stroke for furniture symbols

                  return (
                    <div
                      key={room.id}
                      onPointerDown={e => roomPointerDown(e, room)}
                      onDoubleClick={e => { e.stopPropagation(); setDetailRoom(room) }}
                      onClick={e => { e.stopPropagation(); setSelectedId(room.id) }}
                      onMouseEnter={() => setHoveredRoomId(room.id)}
                      onMouseLeave={() => setHoveredRoomId(null)}
                      style={{
                        position: 'absolute',
                        left: px, top: py, width: pw, height: ph,
                        cursor: isDragging ? 'grabbing' : 'grab',
                        zIndex: isDragging ? 20 : isSel ? 10 : 1,
                        userSelect: 'none',
                        filter: inMulti
                          ? 'drop-shadow(0 0 4px rgba(245,158,11,0.5))'
                          : isSel
                          ? 'drop-shadow(0 0 4px rgba(99,102,241,0.4))'
                          : 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))',
                        transition: isDragging ? 'none' : 'filter 0.15s',
                      }}
                    >
                      {(isGrouped || inMulti) && (
                        <div style={{
                          position: 'absolute', left: 2, top: 2,
                          fontSize: 13, lineHeight: 1, pointerEvents: 'none', zIndex: 30,
                          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))',
                        }}>{inMulti ? '☑️' : '🔒'}</div>
                      )}
                      {/* SVG draws the actual shape (polygon for L, rect for regular) */}
                      <svg
                        width={pw} height={ph}
                        viewBox={`0 0 ${room.width_cm} ${room.height_cm}`}
                        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <clipPath id={clipId}>
                            <polygon points={getRoomPoints(room.width_cm, room.height_cm, shape)} />
                          </clipPath>
                        </defs>

                        {/* Fill */}
                        <polygon
                          points={getRoomPoints(room.width_cm, room.height_cm, shape)}
                          fill={c.fill}
                          stroke={borderColor}
                          strokeWidth={swCm}
                          strokeLinejoin="round"
                        />

                        {/* Furniture inside (clipped to shape) */}
                        <g clipPath={`url(#${clipId})`}>
                          {furniture.map(item => (
                            <g key={item.id} transform={`rotate(${item.rotation}, ${item.x + item.w / 2}, ${item.y + item.h / 2})`}>
                              <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={1} fill="white" fillOpacity="0.7"/>
                              <g transform={`translate(${item.x}, ${item.y})`}>
                                <FurnitureSymbol type={item.typeId} w={item.w} h={item.h} stroke={c.border} strokeWidth={furnSwCm}/>
                              </g>
                            </g>
                          ))}
                        </g>

                      </svg>

                      {/* Hover tooltip */}
                      {hoveredRoomId === room.id && !drag && (
                        <div style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          marginBottom: 6,
                          background: '#1e293b',
                          color: 'white',
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '4px 9px',
                          borderRadius: 6,
                          pointerEvents: 'none',
                          whiteSpace: 'nowrap',
                          zIndex: 200,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                        }}>
                          {room.name}
                          <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: 5 }}>
                            {room.width_cm}×{room.height_cm}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
                {/* Draw preview */}
                {drawState && (() => {
                  const x = Math.min(drawState.sx, drawState.ex) * scale
                  const y = Math.min(drawState.sy, drawState.ey) * scale
                  const w = Math.abs(drawState.ex - drawState.sx) * scale
                  const h = Math.abs(drawState.ey - drawState.sy) * scale
                  const wCm = Math.abs(drawState.ex - drawState.sx)
                  const hCm = Math.abs(drawState.ey - drawState.sy)
                  return (
                    <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} width={cW} height={cH}>
                      <rect x={x} y={y} width={w} height={h}
                        fill="rgba(99,102,241,0.07)" stroke="#6366f1" strokeWidth={1.8} strokeDasharray="7,4" rx={4}/>
                      {w > 40 && (
                        <text x={x + w / 2} y={y - 7} textAnchor="middle" fontSize={11} fill="#6366f1" fontWeight="700">
                          {wCm.toFixed(1)}cm
                        </text>
                      )}
                      {h > 40 && (
                        <text x={x + w + 6} y={y + h / 2 + 4} textAnchor="start" fontSize={11} fill="#6366f1" fontWeight="700">
                          {hCm.toFixed(1)}cm
                        </text>
                      )}
                    </svg>
                  )
                })()}

                {/* Empty state hint overlay */}
                {rooms.length === 0 && !wallMode && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                  }}>
                    <svg width="48" height="48" viewBox="0 0 40 40" fill="none" style={{ opacity: 0.15 }}>
                      <rect x="4" y="4" width="14" height="16" rx="2" stroke="#64748b" strokeWidth="1.5"/>
                      <rect x="22" y="4" width="14" height="10" rx="2" stroke="#64748b" strokeWidth="1.5"/>
                      <rect x="4" y="24" width="14" height="12" rx="2" stroke="#64748b" strokeWidth="1.5"/>
                      <rect x="22" y="18" width="14" height="18" rx="2" stroke="#64748b" strokeWidth="1.5"/>
                    </svg>
                    <p style={{ marginTop: 12, fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
                      왼쪽 <strong style={{ color: '#6366f1' }}>선으로 그리기</strong> 또는 <strong style={{ color: '#6366f1' }}>공간 추가</strong>로 시작하세요
                    </p>
                  </div>
                )}

                {/* Wall drawing overlay */}
                {wallMode && (
                  <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} width={cW} height={cH}>
                    {/* Drawn segments with dimension labels */}
                    {wallPts.map((pt, i) => {
                      if (i === 0) return null
                      const prev = wallPts[i - 1]
                      const len = Math.round(Math.hypot(pt.x - prev.x, pt.y - prev.y))
                      const mx = ((prev.x + pt.x) / 2) * scale
                      const my = ((prev.y + pt.y) / 2) * scale
                      const isH = Math.abs(pt.x - prev.x) >= Math.abs(pt.y - prev.y)
                      return (
                        <g key={i}>
                          <line
                            x1={prev.x * scale} y1={prev.y * scale}
                            x2={pt.x * scale}   y2={pt.y * scale}
                            stroke="#6366f1" strokeWidth={2.5} strokeLinecap="round"
                          />
                          <rect x={mx - 20} y={my - (isH ? 16 : 0) - 8} width={40} height={14} rx={4} fill="#6366f1" fillOpacity={0.9}/>
                          <text x={mx} y={my - (isH ? 16 : 0) + 1.5} textAnchor="middle" fontSize={9} fill="white" fontWeight="700">{len}cm</text>
                        </g>
                      )
                    })}
                    {/* Closing dashed line back to start (when ≥3 pts) */}
                    {wallPts.length >= 3 && wallCursor && (() => {
                      const first = wallPts[0]
                      const last  = wallPts[wallPts.length - 1]
                      // show thin closing hint from last to first
                      return <line
                        x1={last.x * scale} y1={last.y * scale}
                        x2={first.x * scale} y2={first.y * scale}
                        stroke="#6366f1" strokeWidth={1} strokeDasharray="4,4" opacity={0.3}
                      />
                    })()}
                    {/* Preview wall (dashed) */}
                    {wallPts.length > 0 && wallCursor && (
                      <line
                        x1={wallPts[wallPts.length - 1].x * scale}
                        y1={wallPts[wallPts.length - 1].y * scale}
                        x2={wallCursor.x * scale} y2={wallCursor.y * scale}
                        stroke="#6366f1" strokeWidth={2} strokeDasharray="6,4" opacity={0.5}
                      />
                    )}
                    {/* Dimension label on preview wall */}
                    {wallPts.length > 0 && wallCursor && (() => {
                      const from = wallPts[wallPts.length - 1]
                      const len = Math.abs(wallCursor.axis === 'h'
                        ? wallCursor.x - from.x
                        : wallCursor.y - from.y).toFixed(0)
                      const mx = ((from.x + wallCursor.x) / 2) * scale
                      const my = ((from.y + wallCursor.y) / 2) * scale
                      return <text x={mx} y={my - 6} textAnchor="middle" fontSize={10} fill="#6366f1" fontWeight="700">{len}cm</text>
                    })()}
                    {/* Vertex dots */}
                    {wallPts.map((pt, i) => (
                      <circle key={i}
                        cx={pt.x * scale} cy={pt.y * scale}
                        r={i === 0 ? (wallNearClose ? 8 : 5) : 3.5}
                        fill={i === 0 ? (wallNearClose ? '#10b981' : '#6366f1') : 'white'}
                        stroke={i === 0 ? (wallNearClose ? '#10b981' : '#6366f1') : '#6366f1'}
                        strokeWidth={2}
                        style={{ transition: 'r 0.1s, fill 0.1s' }}
                      />
                    ))}
                    {/* Cursor dot */}
                    {wallCursor && (
                      <circle cx={wallCursor.x * scale} cy={wallCursor.y * scale} r={3} fill="white" stroke="#6366f1" strokeWidth={2}/>
                    )}
                  </svg>
                )}

                {/* Wall mode status bar */}
                {wallMode && (
                  <div style={{
                    position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: wallNearClose ? '#065f46' : '#1e293b', color: 'white',
                    fontSize: 11, fontWeight: 500,
                    padding: '5px 10px 5px 14px', borderRadius: 20,
                    pointerEvents: 'auto', zIndex: 50,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    whiteSpace: 'nowrap',
                    transition: 'background 0.2s',
                  }}>
                    <span>
                      {wallNearClose
                        ? '✓ 클릭하면 방이 완성됩니다!'
                        : wallPts.length === 0
                        ? '✏️ 클릭해서 첫 점을 찍으세요'
                        : wallPts.length === 1
                        ? '다음 방향으로 클릭 · Backspace 취소'
                        : `선 ${wallPts.length - 1}개 · 닫으면 방 / 열린 채 완성도 OK`}
                    </span>
                    {wallPts.length >= 1 && !wallNearClose && (
                      <button
                        onClick={() => { setWallPts(prev => prev.slice(0, -1)); setWallCursor(null); setWallNearClose(false) }}
                        style={{
                          background: 'rgba(255,255,255,0.15)', color: 'white',
                          border: '1px solid rgba(255,255,255,0.3)', borderRadius: 12,
                          padding: '2px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 500,
                        }}
                      >← 되돌리기</button>
                    )}
                    {wallPts.length >= 2 && !wallNearClose && (
                      <button
                        onClick={() => finishWalls(wallPts, rooms.length, addRoom)}
                        style={{
                          background: '#10b981', color: 'white',
                          border: 'none', borderRadius: 12,
                          padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 700,
                        }}
                      >완성 ✓</button>
                    )}
                  </div>
                )}

                {/* Poly / polyline vertex editor */}
                {(() => {
                  if (wallMode) return null
                  const room = rooms.find(r => r.id === selectedId)
                  const sd = room?.shape_data
                  if (!room || !sd || (sd.type !== 'poly' && sd.type !== 'polyline')) return null
                  const shapeType = sd.type            // 'poly' | 'polyline'
                  const isOpen = sd.type === 'polyline' // open walls: no closing edge
                  const pts = (vertexDrag?.roomId === room.id && dragPolyPts) ? dragPolyPts : sd.points
                  const rx = room.x_cm * scale
                  const ry = room.y_cm * scale
                  const minPts = isOpen ? 2 : 3
                  const canDelete = pts.length > minPts
                  const edgeCount = isOpen ? pts.length - 1 : pts.length

                  return (
                    <>
                      {/* SVG: edge length labels + edge highlights */}
                      <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 29 }} width={cW} height={cH}>
                        {pts.map((pt, i) => {
                          if (i >= edgeCount) return null   // skip closing edge for open walls
                          const next = pts[(i + 1) % pts.length]
                          const isHov = hoveredEdgeIdx === i
                          const isEditingThis = editingWallLen?.roomId === room.id && editingWallLen?.edgeIdx === i
                          const segLen = Math.round(Math.hypot(next.x - pt.x, next.y - pt.y))
                          const mx = rx + (pt.x + next.x) / 2 * scale
                          const my = ry + (pt.y + next.y) / 2 * scale
                          const isH = Math.abs(next.x - pt.x) >= Math.abs(next.y - pt.y)
                          return (
                            <g key={i}>
                              <line
                                x1={rx + pt.x * scale} y1={ry + pt.y * scale}
                                x2={rx + next.x * scale} y2={ry + next.y * scale}
                                stroke={isHov ? '#6366f1' : '#a5b4fc'}
                                strokeWidth={isHov ? 2.5 : 1.5} strokeDasharray={isHov ? 'none' : '5,4'} opacity={isHov ? 0.7 : 0.4}
                              />
                              {/* Length label - always visible */}
                              {!isEditingThis && (
                                <>
                                  <rect
                                    x={mx - 20} y={my - (isH ? 22 : 4) - 9}
                                    width={40} height={16} rx={5}
                                    fill={isHov ? '#6366f1' : 'white'}
                                    stroke={isHov ? '#6366f1' : '#c7d2fe'}
                                    strokeWidth={1}
                                    opacity={0.95}
                                  />
                                  <text
                                    x={mx} y={my - (isH ? 22 : 4) + 3.5}
                                    textAnchor="middle" fontSize={9}
                                    fill={isHov ? 'white' : '#4f46e5'}
                                    fontWeight="600"
                                  >{segLen}cm</text>
                                </>
                              )}
                            </g>
                          )
                        })}
                      </svg>

                      {/* Edge length click targets + delete buttons */}
                      {pts.map((pt, i) => {
                        if (i >= edgeCount) return null   // skip closing edge for open walls
                        const next = pts[(i + 1) % pts.length]
                        const mx = rx + (pt.x + next.x) / 2 * scale
                        const my = ry + (pt.y + next.y) / 2 * scale
                        const isHov = hoveredEdgeIdx === i
                        const segLen = Math.round(Math.hypot(next.x - pt.x, next.y - pt.y))
                        const isH = Math.abs(next.x - pt.x) >= Math.abs(next.y - pt.y)
                        const labelY = my - (isH ? 22 : 4) - 9
                        const isEditingThis = editingWallLen?.roomId === room.id && editingWallLen?.edgeIdx === i

                        return (
                          <React.Fragment key={`edge-group-${i}`}>
                            {/* Invisible hit area on the edge line itself */}
                            <div
                              onMouseEnter={() => setHoveredEdgeIdx(i)}
                              onMouseLeave={() => setHoveredEdgeIdx(null)}
                              onPointerDown={e => e.stopPropagation()}
                              onClick={e => {
                                e.stopPropagation()
                                // Click on edge line = open length editor
                                if (!isEditingThis) {
                                  setEditingWallLen({ roomId: room.id, edgeIdx: i, currentLen: segLen, px: mx, py: my })
                                }
                              }}
                              style={{
                                position: 'absolute',
                                left: Math.min(rx + pt.x * scale, rx + next.x * scale) - 8,
                                top: Math.min(ry + pt.y * scale, ry + next.y * scale) - 8,
                                width: Math.max(Math.abs(next.x - pt.x) * scale, 16) + 16,
                                height: Math.max(Math.abs(next.y - pt.y) * scale, 16) + 16,
                                cursor: 'pointer', zIndex: 30,
                              }}
                            />

                            {/* Inline length editor popup */}
                            {isEditingThis && (() => {
                              return (
                                <div
                                  onPointerDown={e => e.stopPropagation()}
                                  style={{
                                    position: 'absolute',
                                    left: mx - 60,
                                    top: labelY - 8,
                                    zIndex: 80,
                                    background: 'white',
                                    border: '1.5px solid #6366f1',
                                    borderRadius: 10,
                                    boxShadow: '0 4px 20px rgba(99,102,241,0.25)',
                                    padding: '8px 10px',
                                    display: 'flex', flexDirection: 'column', gap: 6,
                                    minWidth: 130,
                                  }}
                                >
                                  <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 600, marginBottom: 2 }}>벽 길이 수정</div>
                                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                    <input
                                      autoFocus
                                      type="number"
                                      defaultValue={segLen}
                                      min={10}
                                      step={5}
                                      onKeyDown={e => {
                                        e.stopPropagation()
                                        if (e.key === 'Enter') {
                                          const newLen = Math.max(10, parseFloat((e.target as HTMLInputElement).value) || segLen)
                                          const newPts = applyEdgeLength(pts, i, newLen, isOpen)
                                          commitPolyShape(room, newPts, shapeType)
                                          setEditingWallLen(null)
                                        }
                                        if (e.key === 'Escape') setEditingWallLen(null)
                                      }}
                                      style={{
                                        width: 64, border: '1px solid #e0e7ff', borderRadius: 6,
                                        padding: '3px 6px', fontSize: 13, fontWeight: 600, color: '#1e1b4b',
                                        outline: 'none', textAlign: 'right',
                                      }}
                                    />
                                    <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>cm</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button
                                      onClick={e => {
                                        e.stopPropagation()
                                        const input = e.currentTarget.closest('div')?.previousElementSibling?.querySelector('input') as HTMLInputElement
                                        const newLen = Math.max(10, parseFloat(input?.value) || segLen)
                                        const newPts = applyEdgeLength(pts, i, newLen, isOpen)
                                        commitPolyShape(room, newPts, shapeType)
                                        setEditingWallLen(null)
                                      }}
                                      style={{
                                        flex: 1, background: '#6366f1', color: 'white',
                                        border: 'none', borderRadius: 6, padding: '4px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                      }}
                                    >적용</button>
                                    {canDelete && (
                                      <button
                                        onClick={e => {
                                          e.stopPropagation()
                                          const n2 = pts.length
                                          const j = (i + 1) % n2
                                          const newPts = pts.filter((_, k) => k !== i && k !== j)
                                          if (newPts.length >= minPts) {
                                            commitPolyShape(room, newPts, shapeType)
                                          }
                                          setEditingWallLen(null)
                                        }}
                                        style={{
                                          background: '#fee2e2', color: '#dc2626',
                                          border: 'none', borderRadius: 6, padding: '4px 7px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                        }}
                                      >삭제</button>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center' }}>Enter 적용 · Esc 취소</div>
                                </div>
                              )
                            })()}

                            {/* × delete button (shown on hover, right side) */}
                            {canDelete && isHov && !isEditingThis && (
                              <div
                                onMouseEnter={() => setHoveredEdgeIdx(i)}
                                onMouseLeave={() => setHoveredEdgeIdx(null)}
                                onPointerDown={e => e.stopPropagation()}
                                onClick={e => {
                                  e.stopPropagation()
                                  const n = pts.length
                                  const j = (i + 1) % n
                                  const newPts = pts.filter((_, k) => k !== i && k !== j)
                                  if (newPts.length < minPts) return
                                  commitPolyShape(room, newPts, shapeType)
                                  setHoveredEdgeIdx(null)
                                }}
                                title="이 벽 삭제"
                                style={{
                                  position: 'absolute',
                                  left: mx + 18,
                                  top: my - 11,
                                  width: 22, height: 22,
                                  borderRadius: '50%',
                                  background: '#ef4444',
                                  border: '1.5px solid #dc2626',
                                  boxShadow: '0 0 0 3px rgba(239,68,68,0.2),0 2px 8px rgba(0,0,0,0.15)',
                                  cursor: 'pointer',
                                  zIndex: 52,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  userSelect: 'none',
                                }}
                              >
                                <svg width="9" height="9" viewBox="0 0 8 8" fill="none">
                                  <line x1="1.5" y1="1.5" x2="6.5" y2="6.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                                  <line x1="6.5" y1="1.5" x2="1.5" y2="6.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                                </svg>
                              </div>
                            )}
                          </React.Fragment>
                        )
                      })}

                      {/* Vertex drag handles */}
                      {pts.map((pt, i) => {
                        const cx = rx + pt.x * scale
                        const cy = ry + pt.y * scale
                        const isHov = hoveredVertexIdx === i
                        const isDragging = vertexDrag?.idx === i && vertexDrag?.roomId === room.id
                        const size = (isHov || isDragging) ? 20 : 14
                        return (
                          <div
                            key={`v-${i}`}
                            onMouseEnter={() => setHoveredVertexIdx(i)}
                            onMouseLeave={() => setHoveredVertexIdx(null)}
                            onPointerDown={e => {
                              e.stopPropagation()
                              e.currentTarget.setPointerCapture(e.pointerId)
                              setVertexDrag({ roomId: room.id, idx: i, origPts: pts })
                              setDragPolyPts(pts)
                            }}
                            style={{
                              position: 'absolute',
                              left: cx - size / 2,
                              top: cy - size / 2,
                              width: size, height: size,
                              borderRadius: '50%',
                              background: isDragging ? '#6366f1' : (isHov ? '#e0e7ff' : 'white'),
                              border: `2px solid ${isDragging ? '#4f46e5' : '#6366f1'}`,
                              boxShadow: (isHov || isDragging) ? '0 0 0 3px rgba(99,102,241,0.2),0 2px 8px rgba(0,0,0,0.15)' : '0 1px 4px rgba(99,102,241,0.25)',
                              cursor: isDragging ? 'grabbing' : 'grab',
                              zIndex: 55,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: isDragging ? 'none' : 'all 0.1s ease',
                              userSelect: 'none',
                            }}
                          >
                            <div style={{ width: isDragging ? 7 : 5, height: isDragging ? 7 : 5, borderRadius: '50%', background: isDragging ? 'white' : '#6366f1' }}/>
                          </div>
                        )
                      })}

                      {/* Tooltip */}
                      {hoveredEdgeIdx !== null && (() => {
                        const pt = pts[hoveredEdgeIdx]
                        const next = pts[(hoveredEdgeIdx + 1) % pts.length]
                        const mx = rx + (pt.x + next.x) / 2 * scale
                        const my = ry + (pt.y + next.y) / 2 * scale
                        return (
                          <div style={{
                            position: 'absolute', left: mx + 14, top: my - 14,
                            background: '#ef4444', color: 'white',
                            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 7,
                            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                            whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 60,
                          }}>
                            이 벽 삭제
                          </div>
                        )
                      })()}

                      {/* Bottom hint */}
                      <div style={{
                        position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'white', border: '1px solid #e0e7ff', color: '#4f46e5',
                        fontSize: 11, fontWeight: 500, padding: '5px 14px', borderRadius: 20,
                        boxShadow: '0 2px 8px rgba(99,102,241,0.12)',
                        whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 40,
                      }}>
                        <span>{isOpen ? '📐 열린 벽 편집' : '🔵 점 드래그 = 꼭짓점 이동'}</span>
                        <span style={{ color: '#d1d5db' }}>|</span>
                        <span>📏 숫자 클릭 = 길이 수정</span>
                        <span style={{ color: '#d1d5db' }}>|</span>
                        <span>🔴 × = 벽 삭제</span>
                      </div>
                    </>
                  )
                })()}

                {/* Ghost furniture during placement */}
                {placingItem && placingCursor && (() => {
                  const fw = placingItem.w * scale, fh = placingItem.h * scale
                  const px = placingCursor.x * scale - fw / 2
                  const py = placingCursor.y * scale - fh / 2
                  const room = findRoomAt(placingCursor.x, placingCursor.y, rooms)
                  return (
                    <div style={{ position: 'absolute', left: px, top: py, width: fw, height: fh, pointerEvents: 'none', zIndex: 70 }}>
                      <svg width={fw} height={fh} style={{ overflow: 'visible' }}>
                        <rect x={0} y={0} width={fw} height={fh} rx={3}
                          fill={room ? 'rgba(99,102,241,0.1)' : 'rgba(239,68,68,0.08)'}
                          stroke={room ? '#6366f1' : '#ef4444'}
                          strokeWidth={1.5} strokeDasharray="6,3"
                        />
                        <FurnitureSymbol type={placingItem.typeId} w={fw} h={fh}
                          stroke={room ? '#6366f1' : '#ef4444'} strokeWidth={1.2}
                        />
                        <text x={fw / 2} y={fh + 14} textAnchor="middle" fontSize={10} fill={room ? '#6366f1' : '#ef4444'} fontWeight="500">
                          {placingItem.w}×{placingItem.h}cm
                        </text>
                      </svg>
                    </div>
                  )
                })()}

                {/* Snap guide lines */}
                {(snapGuides.x !== null || snapGuides.y !== null) && (
                  <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} width={cW} height={cH}>
                    {snapGuides.x !== null && (
                      <line
                        x1={snapGuides.x * scale} y1={-20}
                        x2={snapGuides.x * scale} y2={cH + 20}
                        stroke="#6366f1" strokeWidth={1.2} strokeDasharray="5,3" opacity={0.7}
                      />
                    )}
                    {snapGuides.y !== null && (
                      <line
                        x1={-20} y1={snapGuides.y * scale}
                        x2={cW + 20} y2={snapGuides.y * scale}
                        stroke="#6366f1" strokeWidth={1.2} strokeDasharray="5,3" opacity={0.7}
                      />
                    )}
                  </svg>
                )}

                {/* Action bar – rendered at canvas level so it's never clipped */}
                {selectedId && !drag && (() => {
                  const room = rooms.find(r => r.id === selectedId)
                  if (!room) return null
                  const px = room.x_cm * scale
                  const py = room.y_cm * scale
                  const ph = room.height_cm * scale
                  // If room is too close to top, show bar below the room instead
                  const showBelow = py < 48
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        left: px,
                        top: showBelow ? py + ph + 6 : py - 40,
                        zIndex: 100,
                        display: 'flex',
                        gap: 4,
                      }}
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setDetailRoom(room)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg transition-colors font-medium whitespace-nowrap"
                      >
                        <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
                          <rect x="2" y="9" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.8"/>
                          <rect x="12" y="5" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.8"/>
                        </svg>
                        가구 배치
                      </button>
                      <button
                        onClick={() => rotateRoom(room.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-md transition-colors whitespace-nowrap"
                      >
                        <RotateCw size={10}/> 회전
                      </button>
                      {room.group_id && (
                        <button
                          onClick={() => unlockGroup(room.group_id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg bg-white border border-amber-200 text-amber-500 hover:bg-amber-50 shadow-md transition-colors whitespace-nowrap"
                        >
                          🔓 그룹해제
                        </button>
                      )}
                      <button
                        onClick={() => deleteRoom(room.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg bg-white border border-red-100 text-red-400 hover:bg-red-50 shadow-md transition-colors whitespace-nowrap"
                      >
                        <Trash2 size={10}/> 삭제
                      </button>
                    </div>
                  )
                })()}

                {/* Multi-select group action bar (bottom-center) */}
                {multiSel.length >= 2 && !drag && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'absolute', left: '50%', bottom: 12, transform: 'translateX(-50%)',
                      zIndex: 120, display: 'flex', gap: 6, alignItems: 'center',
                      background: 'white', padding: '8px 10px', borderRadius: 14,
                      boxShadow: '0 6px 24px rgba(0,0,0,0.18)', border: '1px solid #fde68a',
                    }}
                  >
                    <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{multiSel.length}개 선택됨</span>
                    <button
                      onClick={lockGroup}
                      className="flex items-center gap-1 px-3 py-1.5 text-[12px] rounded-lg bg-amber-500 text-white hover:bg-amber-600 font-semibold whitespace-nowrap"
                    >
                      🔒 함께 묶기
                    </button>
                    <button
                      onClick={() => { setMultiSel([]); setMultiMode(false) }}
                      className="px-2.5 py-1.5 text-[12px] rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 whitespace-nowrap"
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between mt-3 px-1">
              <div className="flex gap-3">
                {rooms.filter(r => (roomFurniture[r.id] ?? []).length > 0).map(r => {
                  const c = ROOM_COLORS[r.color] ?? DEFAULT_COLOR
                  const fCount = (roomFurniture[r.id] ?? []).length
                  return (
                    <div key={r.id} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: c.border }}/>
                      <span className="text-[10px] text-gray-400">{r.name} ({fCount})</span>
                    </div>
                  )
                })}
              </div>
              <span className="text-[10px] text-gray-300">더블클릭 → 가구 배치</span>
            </div>
          </div>
      </main>

      {/* ══ MOBILE BOTTOM DOCK ═════════════════════════════════════════════ */}
      {isMobile && (
        <div
          onPointerDown={e => e.stopPropagation()}
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 80,
            background: 'white', borderTop: '1px solid #eef2ff',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
            padding: '8px 10px calc(8px + env(safe-area-inset-bottom))',
            display: 'flex', alignItems: 'stretch', gap: 6,
          }}
        >
          {/* Drawing tools */}
          {([
            { id: 'select', label: '선택', icon: <path d="M4 3l11 5-4.5 1.5L9 14 4 3z" fill="currentColor"/> },
            { id: 'rect', label: '사각형', icon: <rect x="3" y="5" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.8"/> },
            { id: 'wall', label: '선', icon: <><path d="M3 16L9 5l3 6 5-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="3" cy="16" r="1.8" fill="currentColor"/><circle cx="17" cy="7" r="1.8" fill="currentColor"/></> },
          ] as { id: Tool; label: string; icon: React.ReactNode }[]).map(t => {
            const active = tool === t.id
            return (
              <button
                key={t.id}
                onClick={() => { setTool(t.id); setWallPts([]); setWallCursor(null); setWallNearClose(false); setSelectedId(null); setDrawState(null) }}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  padding: '8px 0', borderRadius: 12, border: 'none',
                  background: active ? '#6366f1' : '#f8fafc',
                  color: active ? 'white' : '#475569', fontSize: 11, fontWeight: 600,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">{t.icon}</svg>
                {t.label}
              </button>
            )
          })}

          <div style={{ width: 1, background: '#eef2ff', margin: '2px 2px' }}/>

          {/* Multi-select toggle */}
          <button
            onClick={() => { setMultiMode(m => !m); setMultiSel([]); setTool('select') }}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              padding: '8px 0', borderRadius: 12, border: 'none',
              background: multiMode ? '#f59e0b' : '#f8fafc', color: multiMode ? 'white' : '#475569', fontSize: 11, fontWeight: 600,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
              <rect x="10" y="10" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
            </svg>
            다중선택
          </button>

          {/* Undo */}
          <button
            onClick={() => undo()}
            disabled={!canUndo}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              padding: '8px 0', borderRadius: 12, border: 'none',
              background: '#f8fafc', color: canUndo ? '#475569' : '#cbd5e1', fontSize: 11, fontWeight: 600,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 8h9a5 5 0 0 1 0 10H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            되돌리기
          </button>

          {/* Open sidebar (rooms/furniture) */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              padding: '8px 0', borderRadius: 12, border: 'none',
              background: '#eef2ff', color: '#4f46e5', fontSize: 11, fontWeight: 700,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
              <rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
              <rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
              <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
            </svg>
            공간·가구
          </button>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showRoomForm && (
        <RoomFormModal
          room={editingRoom}
          presetWidth={pendingPos?.w}
          presetHeight={pendingPos?.h}
          initialShapeType={presetShape ?? undefined}
          onSave={(name, w, h, shape) => {
            addRoom(name, w, h, shape, pendingPos?.x, pendingPos?.y)
            setPendingPos(null)
            setPresetShape(null)
          }}
          onClose={() => { setShowRoomForm(false); setEditingRoom(null); setPendingPos(null); setPresetShape(null) }}
        />
      )}
      {showAptModal && project && (
        <AptSizeModal
          aptW={project.apt_w}
          aptH={project.apt_h}
          onSave={(w, h) => updateApartment(w, h)}
          onClose={() => setShowAptModal(false)}
        />
      )}
    </div>
  )
}
