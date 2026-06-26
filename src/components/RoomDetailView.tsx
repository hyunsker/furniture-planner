import { useState, useRef, useCallback } from 'react'
import type { Room, FurnitureItem } from '../types'
import { getRoomPoints } from '../types'
import FurnitureSymbol from './FurnitureSymbol'
import AddFurnitureModal from './AddFurnitureModal'
import { FURNITURE_LIBRARY, FURNITURE_CATEGORIES, type FurnitureVariant, type FurnitureType } from '../lib/furniture-library'

export type { FurnitureItem }

interface Props {
  room: Room
  items: FurnitureItem[]
  onItemsChange: (items: FurnitureItem[]) => void
  onBack: () => void
}

const SCALE = 2.8
const SNAP_CM = 5

function snapTo(val: number, grid: number) {
  return Math.round(val / grid) * grid
}

type AddPending = { ft: FurnitureType; variant: FurnitureVariant }

export default function RoomDetailView({ room, items, onItemsChange, onBack }: Props) {
  const [selectedId, setSelectedId]         = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState(FURNITURE_CATEGORIES[0])
  const [expandedItem, setExpandedItem]     = useState<string | null>(null)
  const [addPending, setAddPending]         = useState<AddPending | null>(null)
  const [searchQuery, setSearchQuery]       = useState('')
  const [dragState, setDragState] = useState<{
    id: string; startX: number; startY: number; origX: number; origY: number
  } | null>(null)

  const canvasRef = useRef<SVGSVGElement>(null)

  const rw = room.width_cm
  const rh = room.height_cm
  const canvasW = rw * SCALE
  const canvasH = rh * SCALE

  const addFurniture = useCallback((ft: FurnitureType, w: number, h: number) => {
    const newItem: FurnitureItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      typeId: addPending?.variant.id ?? 'sofa-2',
      label: `${ft.name}`,
      x: snapTo(Math.max(0, rw / 2 - w / 2), SNAP_CM),
      y: snapTo(Math.max(0, rh / 2 - h / 2), SNAP_CM),
      w,
      h,
      rotation: 0,
    }
    onItemsChange([...items, newItem])
    setSelectedId(newItem.id)
    setAddPending(null)
  }, [addPending, items, onItemsChange, rw, rh])

  const rotateItem = useCallback((id: string) => {
    onItemsChange(items.map(it => {
      if (it.id !== id) return it
      const swapped = it.rotation % 180 === 0
      return { ...it, rotation: (it.rotation + 90) % 360, w: swapped ? it.h : it.w, h: swapped ? it.w : it.h }
    }))
  }, [items, onItemsChange])

  const deleteItem = useCallback((id: string) => {
    onItemsChange(items.filter(it => it.id !== id))
    if (selectedId === id) setSelectedId(null)
  }, [items, onItemsChange, selectedId])

  const onItemPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    e.stopPropagation()
    setSelectedId(id)
    const item = items.find(it => it.id === id)
    if (!item) return
    setDragState({ id, startX: e.clientX, startY: e.clientY, origX: item.x, origY: item.y })
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }, [items])

  const onCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState) return
    const dx = (e.clientX - dragState.startX) / SCALE
    const dy = (e.clientY - dragState.startY) / SCALE
    onItemsChange(items.map(it => {
      if (it.id !== dragState.id) return it
      return {
        ...it,
        x: snapTo(Math.max(0, Math.min(rw - it.w, dragState.origX + dx)), SNAP_CM),
        y: snapTo(Math.max(0, Math.min(rh - it.h, dragState.origY + dy)), SNAP_CM),
      }
    }))
  }, [dragState, items, onItemsChange, rw, rh])

  const onCanvasPointerUp = useCallback(() => setDragState(null), [])

  const selectedItem = items.find(it => it.id === selectedId)

  // Search logic
  const searchLower = searchQuery.trim().toLowerCase()
  const searchResults = searchLower
    ? FURNITURE_LIBRARY.filter(ft =>
        ft.name.toLowerCase().includes(searchLower) ||
        ft.category.toLowerCase().includes(searchLower) ||
        ft.variants.some(v => v.label.toLowerCase().includes(searchLower))
      )
    : []
  const categorizedFurniture = FURNITURE_LIBRARY.filter(ft => ft.category === activeCategory)

  return (
    <div className="flex h-screen bg-[#F4F5F7] overflow-hidden">

      {/* ── Left Panel ────────────────────────────────────────────────────── */}
      <aside className="w-[260px] bg-white border-r border-gray-100 flex flex-col shrink-0 shadow-sm">

        {/* Back + Room info */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors mb-3"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            전체 도면
          </button>
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="16" height="16" rx="2" stroke="#6366f1" strokeWidth="1.5"/>
                <path d="M2 8h16M8 8v10" stroke="#6366f1" strokeWidth="1.5"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{room.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{rw} × {rh} cm &nbsp;·&nbsp; {(rw * rh / 10000).toFixed(1)} m²</p>
            </div>
          </div>
        </div>

        <>
        {/* Search bar */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" width="14" height="14" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="가구 검색... (소파, 침대, 옷장)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {searchQuery ? (
          /* Search results */
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
            {searchResults.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">검색 결과 없음</p>
            ) : searchResults.map(ft => (
              <div key={ft.name} className="rounded-xl border border-gray-100 overflow-hidden">
                <p className="px-3 py-2 text-[11px] font-semibold text-gray-500 bg-gray-50">{ft.category} · {ft.name}</p>
                <div className="px-2 pb-2 pt-1 space-y-1">
                  {ft.variants.map((v, vi) => (
                    <button
                      key={vi}
                      onClick={() => setAddPending({ ft, variant: v })}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-white border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-colors text-left group"
                    >
                      <div>
                        <p className="text-[12px] font-medium text-gray-700 group-hover:text-indigo-700">{v.label}</p>
                        <p className="text-[10px] text-gray-400">{v.w} × {v.h} cm</p>
                      </div>
                      <div className="w-9 h-7 flex items-center justify-center">
                        <svg width={Math.min(36, v.w * 0.18)} height={Math.min(28, v.h * 0.18)} viewBox={`0 0 ${v.w} ${v.h}`} preserveAspectRatio="xMidYMid meet">
                          <FurnitureSymbol type={v.id} w={v.w} h={v.h} stroke="#6366f1" strokeWidth={Math.max(4, v.w * 0.025)} />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Category browser */
          <>
        {/* Category tabs */}
        <div className="flex overflow-x-auto border-b border-gray-100 px-2 pt-2 gap-0.5 shrink-0 scrollbar-hide">
          {FURNITURE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-t-md whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-100 border-b-0'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Furniture list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {categorizedFurniture.map(ft => (
            <div key={ft.name} className="rounded-xl border border-gray-100 overflow-hidden">
              <button
                onClick={() => setExpandedItem(expandedItem === ft.name ? null : ft.name)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <span className="text-[13px] font-medium text-gray-700">{ft.name}</span>
                <svg
                  className={`w-3.5 h-3.5 text-gray-300 transition-transform ${expandedItem === ft.name ? 'rotate-180' : ''}`}
                  viewBox="0 0 16 16" fill="none"
                >
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {expandedItem === ft.name && (
                <div className="border-t border-gray-50 px-2 pb-2 pt-1 space-y-1 bg-gray-50/50">
                  {ft.variants.map((v, vi) => (
                    <button
                      key={vi}
                      onClick={() => setAddPending({ ft, variant: v })}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-white border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-colors text-left group"
                    >
                      <div>
                        <p className="text-[12px] font-medium text-gray-700 group-hover:text-indigo-700">{v.label}</p>
                        <p className="text-[10px] text-gray-400">{v.w} × {v.h} cm</p>
                      </div>
                      {/* Mini SVG preview */}
                      <div className="w-9 h-7 flex items-center justify-center">
                        <svg
                          width={Math.min(36, v.w * 0.18)}
                          height={Math.min(28, v.h * 0.18)}
                          viewBox={`0 0 ${v.w} ${v.h}`}
                          preserveAspectRatio="xMidYMid meet"
                        >
                          <FurnitureSymbol type={v.id} w={v.w} h={v.h} stroke="#6366f1" strokeWidth={Math.max(4, v.w * 0.025)} />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

          </>
        )}
          </>

        {/* Selected item controls */}
        {selectedItem && (
          <div className="px-3 py-3 border-t border-gray-100 bg-gray-50/60">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-gray-800 truncate">{selectedItem.label}</p>
                <p className="text-[10px] text-gray-400">{selectedItem.w} × {selectedItem.h} cm</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => rotateItem(selectedItem.id)}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-[11px] text-gray-600 transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                회전
              </button>
              <button
                onClick={() => deleteItem(selectedItem.id)}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 text-[11px] text-red-500 transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                삭제
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ── Canvas ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-10">
        <div>
          {/* Dimensions label */}
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[11px] text-gray-400">{rw} cm</p>
            <p className="text-[11px] text-gray-400">{items.length}개 가구</p>
          </div>

          <div className="flex items-start">
            {/* Left ruler */}
            <div className="relative mr-1" style={{ width: 28, height: canvasH }}>
              {Array.from({ length: Math.floor(rh / 50) + 1 }, (_, i) => i * 50).map(y => (
                <div
                  key={y}
                  className="absolute right-1 text-[9px] text-gray-300 -translate-y-1/2"
                  style={{ top: y * SCALE }}
                >
                  {y}
                </div>
              ))}
            </div>

            <div>
              {/* Top ruler */}
              <div className="relative mb-1" style={{ width: canvasW, height: 20 }}>
                {Array.from({ length: Math.floor(rw / 50) + 1 }, (_, i) => i * 50).map(x => (
                  <div
                    key={x}
                    className="absolute top-0 text-[9px] text-gray-300 -translate-x-1/2"
                    style={{ left: x * SCALE }}
                  >
                    {x}
                  </div>
                ))}
              </div>

              {/* SVG canvas */}
              <svg
                ref={canvasRef}
                width={canvasW}
                height={canvasH}
                className="block bg-white rounded-lg shadow-lg select-none"
                style={{ cursor: dragState ? 'grabbing' : 'default' }}
                onPointerMove={onCanvasPointerMove}
                onPointerUp={onCanvasPointerUp}
                onClick={() => setSelectedId(null)}
              >
                {/* Grid pattern + shape clip */}
                <defs>
                  <pattern id="rd-grid-sm" width={10 * SCALE} height={10 * SCALE} patternUnits="userSpaceOnUse">
                    <path d={`M ${10 * SCALE} 0 L 0 0 0 ${10 * SCALE}`} fill="none" stroke="#f1f5f9" strokeWidth="0.5"/>
                  </pattern>
                  <pattern id="rd-grid-lg" width={50 * SCALE} height={50 * SCALE} patternUnits="userSpaceOnUse">
                    <rect width={50 * SCALE} height={50 * SCALE} fill="url(#rd-grid-sm)"/>
                    <path d={`M ${50 * SCALE} 0 L 0 0 0 ${50 * SCALE}`} fill="none" stroke="#e2e8f0" strokeWidth="0.8"/>
                  </pattern>
                  <clipPath id="rd-room-clip">
                    <polygon points={getRoomPoints(canvasW, canvasH, room.shape_data ?? { type: 'rect' })} />
                  </clipPath>
                </defs>

                {/* Grid clipped to room shape */}
                <g clipPath="url(#rd-room-clip)">
                  <rect width={canvasW} height={canvasH} fill="url(#rd-grid-lg)"/>
                </g>

                {/* Room border as polygon */}
                <polygon
                  points={getRoomPoints(canvasW, canvasH, room.shape_data ?? { type: 'rect' })}
                  fill="none" stroke="#334155" strokeWidth={2.5} strokeLinejoin="round"
                />

                {/* Furniture items (clipped to room shape) */}
                <g clipPath="url(#rd-room-clip)">
                {items.map(item => {
                  const px = item.x * SCALE
                  const py = item.y * SCALE
                  const pw = item.w * SCALE
                  const ph = item.h * SCALE
                  const cx = px + pw / 2
                  const cy = py + ph / 2
                  const isSel = item.id === selectedId

                  return (
                    <g
                      key={item.id}
                      transform={`rotate(${item.rotation}, ${cx}, ${cy})`}
                      onPointerDown={e => onItemPointerDown(e, item.id)}
                      style={{ cursor: dragState?.id === item.id ? 'grabbing' : 'grab' }}
                    >
                      {/* Shadow rect */}
                      <rect x={px + 2} y={py + 2} width={pw} height={ph} rx={2} fill="#00000010"/>
                      {/* White fill */}
                      <rect x={px} y={py} width={pw} height={ph} rx={2} fill="white"/>
                      {/* Symbol */}
                      <g transform={`translate(${px}, ${py})`}>
                        <FurnitureSymbol type={item.typeId} w={pw} h={ph} stroke="#1e293b" strokeWidth={1.5}/>
                      </g>
                      {/* Selection outline */}
                      {isSel && (
                        <rect
                          x={px - 3} y={py - 3} width={pw + 6} height={ph + 6}
                          rx={4} fill="none" stroke="#6366f1" strokeWidth={1.8} strokeDasharray="6,3"
                        />
                      )}
                      {/* Label */}
                      <text
                        x={cx} y={cy}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize={Math.max(8, Math.min(13, pw / 7))}
                        fill="#64748b"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {item.label}
                      </text>
                    </g>
                  )
                })}
                </g>
              </svg>

              {/* Bottom hint */}
              <p className="text-[10px] text-gray-300 mt-2 text-center">
                드래그로 이동 &nbsp;·&nbsp; 선택 후 왼쪽 패널에서 회전/삭제
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Add Furniture Modal ───────────────────────────────────────────── */}
      {addPending && (
        <AddFurnitureModal
          typeName={`${addPending.ft.name} (${addPending.variant.label})`}
          typeId={addPending.variant.id}
          defaultW={addPending.variant.w}
          defaultH={addPending.variant.h}
          onConfirm={(w, h) => addFurniture(addPending.ft, w, h)}
          onClose={() => setAddPending(null)}
        />
      )}
    </div>
  )
}
