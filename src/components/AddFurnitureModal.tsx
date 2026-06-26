import { useState } from 'react'
import FurnitureSymbol from './FurnitureSymbol'

interface Props {
  typeName: string
  typeId: string
  defaultW: number
  defaultH: number
  onConfirm: (w: number, h: number) => void
  onClose: () => void
}

export default function AddFurnitureModal({ typeName, typeId, defaultW, defaultH, onConfirm, onClose }: Props) {
  const [w, setW] = useState(defaultW)
  const [h, setH] = useState(defaultH)

  function handleConfirm() {
    const cw = Math.max(10, Math.min(1000, w))
    const ch = Math.max(10, Math.min(1000, h))
    onConfirm(cw, ch)
  }

  const previewW = 160
  const previewH = Math.round((h / w) * previewW)
  const clampedPreviewH = Math.max(40, Math.min(200, previewH))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{typeName} 추가</h3>
          <p className="text-xs text-gray-400 mt-0.5">크기를 조절하세요</p>
        </div>

        {/* Preview */}
        <div className="flex items-center justify-center py-6 bg-gray-50 border-b border-gray-100">
          <svg
            width={previewW}
            height={clampedPreviewH}
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <FurnitureSymbol type={typeId} w={w} h={h} stroke="#4f46e5" strokeWidth={Math.max(3, w * 0.02)} />
          </svg>
        </div>

        {/* Size inputs */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-600">너비 (가로)</span>
              <span className="text-xs font-semibold text-indigo-600">{w} cm</span>
            </label>
            <input
              type="range"
              min={30}
              max={500}
              step={5}
              value={w}
              onChange={e => setW(Number(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-300">30</span>
              <span className="text-[10px] text-gray-300">500cm</span>
            </div>
          </div>

          <div>
            <label className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-600">깊이 (세로)</span>
              <span className="text-xs font-semibold text-indigo-600">{h} cm</span>
            </label>
            <input
              type="range"
              min={30}
              max={500}
              step={5}
              value={h}
              onChange={e => setH(Number(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-300">30</span>
              <span className="text-[10px] text-gray-300">500cm</span>
            </div>
          </div>

          {/* Direct input */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-gray-400 mb-1 block">너비 직접 입력</label>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <input
                  type="number"
                  min={10}
                  max={1000}
                  value={w}
                  onChange={e => setW(Number(e.target.value))}
                  className="flex-1 text-sm text-center py-1.5 outline-none w-0"
                />
                <span className="px-2 text-xs text-gray-400 bg-gray-50 border-l border-gray-200 py-1.5">cm</span>
              </div>
            </div>
            <div className="flex items-end pb-1 text-gray-300 text-sm">×</div>
            <div className="flex-1">
              <label className="text-[10px] text-gray-400 mb-1 block">깊이 직접 입력</label>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <input
                  type="number"
                  min={10}
                  max={1000}
                  value={h}
                  onChange={e => setH(Number(e.target.value))}
                  className="flex-1 text-sm text-center py-1.5 outline-none w-0"
                />
                <span className="px-2 text-xs text-gray-400 bg-gray-50 border-l border-gray-200 py-1.5">cm</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
          >
            방에 추가
          </button>
        </div>
      </div>
    </div>
  )
}
