import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { FURNITURE_TEMPLATES, FURNITURE_CATEGORIES } from '../lib/furniture-templates'
import type { FurnitureTemplate } from '../types'

function DraggableTemplate({ template }: { template: FurnitureTemplate }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `template-${template.type}`,
    data: { type: 'template', template },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing select-none transition-opacity ${
        isDragging ? 'opacity-40' : 'hover:bg-gray-50'
      }`}
    >
      <div
        className="w-7 h-7 rounded flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={{ backgroundColor: template.color }}
      >
        {template.label[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700 truncate">{template.label}</p>
        <p className="text-[10px] text-gray-400">
          {template.width_cm} × {template.height_cm}cm
        </p>
      </div>
    </div>
  )
}

export default function FurniturePanel() {
  const [activeCategory, setActiveCategory] = useState('bedroom')

  const currentCategory = FURNITURE_CATEGORIES.find((c) => c.key === activeCategory)
  const templates = FURNITURE_TEMPLATES.filter((t) =>
    currentCategory?.types.includes(t.type)
  )

  return (
    <div className="w-52 bg-white border-r border-gray-100 flex flex-col h-full">
      <div className="px-3 py-3 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">가구</p>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-100">
        {FURNITURE_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${
              activeCategory === cat.key
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Templates */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {templates.map((t) => (
          <DraggableTemplate key={t.type} template={t} />
        ))}
      </div>

      <div className="p-3 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          가구를 방 캔버스로 드래그하여 배치하세요
        </p>
      </div>
    </div>
  )
}
