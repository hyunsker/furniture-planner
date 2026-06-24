import { useState } from 'react'
import { X } from 'lucide-react'
import type { Room } from '../types'

interface Props {
  room?: Room | null
  onSave: (name: string, width: number, height: number) => void
  onClose: () => void
}

export default function RoomSettings({ room, onSave, onClose }: Props) {
  const [name, setName] = useState(room?.name ?? '')
  const [width, setWidth] = useState(room?.width_cm?.toString() ?? '400')
  const [height, setHeight] = useState(room?.height_cm?.toString() ?? '300')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const w = parseFloat(width)
    const h = parseFloat(height)
    if (!name.trim() || isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return
    onSave(name.trim(), w, h)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            {room ? '방 수정' : '새 방 추가'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">방 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 안방, 거실, 작은방"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">가로 (cm)</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                min="50"
                max="2000"
                step="1"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">세로 (cm)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                min="50"
                max="2000"
                step="1"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400">
            {width && height && !isNaN(+width) && !isNaN(+height)
              ? `${width}cm × ${height}cm = ${(+width / 100).toFixed(1)}m × ${(+height / 100).toFixed(1)}m`
              : '치수를 입력하세요'}
          </p>
          <button
            type="submit"
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {room ? '수정 완료' : '방 추가'}
          </button>
        </form>
      </div>
    </div>
  )
}
