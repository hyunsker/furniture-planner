import { useState, useCallback } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { Room, FurnitureItem } from '../types'
import FurnitureItemComponent from './FurnitureItemComponent'

interface Props {
  room: Room
  items: FurnitureItem[]
  onUpdateItem: (id: string, updates: Partial<FurnitureItem>) => void
  onDeleteItem: (id: string) => void
}

const GRID_CM = 10
const MAX_PX = 720

export default function RoomCanvas({ room, items, onUpdateItem, onDeleteItem }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Calculate scale to fit room in MAX_PX
  const scaleW = MAX_PX / room.width_cm
  const scaleH = MAX_PX / room.height_cm
  const scale = Math.min(scaleW, scaleH, 2.5)

  const canvasW = room.width_cm * scale
  const canvasH = room.height_cm * scale

  const { setNodeRef: setDropRef } = useDroppable({ id: `room-canvas-${room.id}` })

  const handleCanvasClick = useCallback(() => setSelectedId(null), [])

  function handleRotate(item: FurnitureItem) {
    const newRotation = ((item.rotation ?? 0) + 90) % 360
    onUpdateItem(item.id, { rotation: newRotation })
  }

  // Draw grid lines
  const gridLines: React.ReactNode[] = []
  for (let x = 0; x <= room.width_cm; x += GRID_CM) {
    gridLines.push(
      <line
        key={`vl-${x}`}
        x1={x * scale}
        y1={0}
        x2={x * scale}
        y2={canvasH}
        stroke="#e2e8f0"
        strokeWidth={x % 100 === 0 ? 1.5 : 0.5}
      />
    )
  }
  for (let y = 0; y <= room.height_cm; y += GRID_CM) {
    gridLines.push(
      <line
        key={`hl-${y}`}
        x1={0}
        y1={y * scale}
        x2={canvasW}
        y2={y * scale}
        stroke="#e2e8f0"
        strokeWidth={y % 100 === 0 ? 1.5 : 0.5}
      />
    )
  }

  // Scale ruler labels
  const rulerLabels: React.ReactNode[] = []
  for (let x = 0; x <= room.width_cm; x += 100) {
    rulerLabels.push(
      <text
        key={`rx-${x}`}
        x={x * scale}
        y={-4}
        fontSize={9}
        fill="#94a3b8"
        textAnchor="middle"
      >
        {x}
      </text>
    )
  }
  for (let y = 100; y <= room.height_cm; y += 100) {
    rulerLabels.push(
      <text
        key={`ry-${y}`}
        x={-4}
        y={y * scale + 3}
        fontSize={9}
        fill="#94a3b8"
        textAnchor="end"
      >
        {y}
      </text>
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50 flex items-start justify-center p-8">
      <div>
        {/* Room label */}
        <div className="flex items-baseline gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-700">{room.name}</h2>
          <span className="text-xs text-gray-400">
            {room.width_cm}cm × {room.height_cm}cm &nbsp;·&nbsp;
            {(room.width_cm / 100).toFixed(1)}m × {(room.height_cm / 100).toFixed(1)}m
          </span>
        </div>

        {/* Canvas with ruler */}
        <div style={{ position: 'relative' }}>
          <svg
            style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}
            width={canvasW}
            height={canvasH}
          >
            <g transform="translate(0,0)">{rulerLabels}</g>
          </svg>

          {/* Drop zone */}
          <div
            ref={setDropRef}
            onClick={handleCanvasClick}
            style={{
              position: 'relative',
              width: canvasW,
              height: canvasH,
              background: '#ffffff',
              border: '2px solid #cbd5e1',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {/* Grid SVG */}
            <svg
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              width={canvasW}
              height={canvasH}
            >
              {gridLines}
            </svg>

            {/* Furniture items */}
            {items.map((item) => (
              <FurnitureItemComponent
                key={item.id}
                item={item}
                scale={scale}
                isSelected={selectedId === item.id}
                onSelect={() => setSelectedId(item.id)}
                onRotate={() => handleRotate(item)}
                onDelete={() => {
                  onDeleteItem(item.id)
                  setSelectedId(null)
                }}
              />
            ))}
          </div>

          {/* cm label */}
          <p className="text-[10px] text-gray-400 mt-1 text-right">단위: cm · 그리드 10cm</p>
        </div>
      </div>
    </div>
  )
}
