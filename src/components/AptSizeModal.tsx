import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  aptW: number
  aptH: number
  onSave: (w: number, h: number) => void
  onClose: () => void
}

export default function AptSizeModal({ aptW, aptH, onSave, onClose }: Props) {
  // UI is in mm; data stays in cm
  const [w, setW] = useState(Math.round(aptW * 10).toString())
  const [h, setH] = useState(Math.round(aptH * 10).toString())

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const pw = parseFloat(w), ph = parseFloat(h)
    if (isNaN(pw) || isNaN(ph) || pw < 1000 || ph < 1000) return
    onSave(Math.round(pw) / 10, Math.round(ph) / 10)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">전체 도면 크기</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-gray-500">아파트 전체 가로·세로 치수를 입력하세요</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">전체 가로 (mm)</label>
              <input type="number" value={w} onChange={e => setW(e.target.value)} min="1000" step="5"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">전체 세로 (mm)</label>
              <input type="number" value={h} onChange={e => setH(e.target.value)} min="1000" step="5"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>
          {w && h && !isNaN(+w) && !isNaN(+h) && (
            <p className="text-xs text-gray-400">
              {w}mm × {h}mm = {(+w / 1000).toFixed(2)}m × {(+h / 1000).toFixed(2)}m
            </p>
          )}
          <button type="submit"
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
            적용
          </button>
        </form>
      </div>
    </div>
  )
}
