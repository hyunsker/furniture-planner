import { useDraggable } from '@dnd-kit/core'
import { RotateCw, Trash2 } from 'lucide-react'
import type { FurnitureItem } from '../types'

interface Props {
  item: FurnitureItem
  scale: number
  isSelected: boolean
  onSelect: () => void
  onRotate: () => void
  onDelete: () => void
}

export default function FurnitureItemComponent({
  item,
  scale,
  isSelected,
  onSelect,
  onRotate,
  onDelete,
}: Props) {
  const isRotated = item.rotation === 90 || item.rotation === 270

  const displayW = isRotated ? item.height_cm : item.width_cm
  const displayH = isRotated ? item.width_cm : item.height_cm

  const pxW = displayW * scale
  const pxH = displayH * scale

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { type: 'item', item },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        left: item.x * scale,
        top: item.y * scale,
        width: pxW,
        height: pxH,
        backgroundColor: item.color + 'cc',
        border: isSelected ? '2px solid #4f46e5' : '1.5px solid ' + item.color,
        borderRadius: 4,
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.5 : 1,
        zIndex: isSelected ? 10 : 1,
        userSelect: 'none',
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {/* Drag handle covers full surface */}
      <div
        {...listeners}
        {...attributes}
        style={{ position: 'absolute', inset: 0, cursor: isDragging ? 'grabbing' : 'grab' }}
      />

      {/* Label */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <span style={{ fontSize: Math.min(pxW, pxH) * 0.28, color: '#fff', fontWeight: 600, lineHeight: 1 }}>
          {item.label}
        </span>
        <span style={{ fontSize: Math.min(pxW, pxH) * 0.16, color: '#ffffffaa', marginTop: 1 }}>
          {item.width_cm}×{item.height_cm}
        </span>
      </div>

      {/* Action buttons */}
      {isSelected && (
        <div
          style={{ position: 'absolute', top: -28, left: 0, display: 'flex', gap: 4, pointerEvents: 'all' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onRotate}
            className="bg-white border border-gray-200 rounded px-1.5 py-0.5 flex items-center gap-1 text-xs text-gray-600 hover:bg-indigo-50 shadow-sm"
          >
            <RotateCw size={11} /> 회전
          </button>
          <button
            onClick={onDelete}
            className="bg-white border border-red-200 rounded px-1.5 py-0.5 flex items-center gap-1 text-xs text-red-500 hover:bg-red-50 shadow-sm"
          >
            <Trash2 size={11} /> 삭제
          </button>
        </div>
      )}
    </div>
  )
}
