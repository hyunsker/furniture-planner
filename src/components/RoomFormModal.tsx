import { useState } from 'react'
import { X } from 'lucide-react'
import type { Room, ShapeData, RoomCorner } from '../types'
import { getRoomPoints } from '../types'

interface Props {
  room?: Room | null
  presetWidth?: number
  presetHeight?: number
  initialShapeType?: 'rect' | 'L'
  onSave: (name: string, width: number, height: number, shape: ShapeData) => void
  onClose: () => void
}

const CORNER_LABELS: Record<RoomCorner, string> = {
  tl: '왼쪽 위', tr: '오른쪽 위', bl: '왼쪽 아래', br: '오른쪽 아래',
}

function ShapePreview({ w, h, shape, size = 80 }: { w: number; h: number; shape: ShapeData; size?: number }) {
  const aspect = w / h
  const svgW = aspect >= 1 ? size : size * aspect
  const svgH = aspect < 1 ? size : size / aspect
  const points = getRoomPoints(svgW, svgH, shape)
  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
      <polygon points={points} fill="#eff6ff" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round" />
      {shape.type === 'L' && (() => {
        const { cutout_w: cw, cutout_h: ch, corner } = shape
        const sx = svgW / w, sy = svgH / h
        const pw = cw * sx, ph = ch * sy
        const pos: Record<RoomCorner, { x: number; y: number }> = {
          tl: { x: 0, y: 0 }, tr: { x: svgW - pw, y: 0 },
          bl: { x: 0, y: svgH - ph }, br: { x: svgW - pw, y: svgH - ph },
        }
        const { x, y } = pos[corner]
        return <rect x={x} y={y} width={pw} height={ph} fill="white" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,2" />
      })()}
    </svg>
  )
}

// Convert value between cm and mm
function toCm(val: number, unit: 'cm' | 'mm') { return unit === 'mm' ? val / 10 : val }
function fromCm(val: number, unit: 'cm' | 'mm') { return unit === 'mm' ? val * 10 : val }
function stepFor(unit: 'cm' | 'mm') { return unit === 'mm' ? 5 : 0.5 }

export default function RoomFormModal({ room, presetWidth, presetHeight, initialShapeType, onSave, onClose }: Props) {
  const initShape = room?.shape_data ?? { type: 'rect' as const }
  const [unit, setUnit] = useState<'cm' | 'mm'>('mm')

  const initW = room?.width_cm ?? presetWidth ?? 0
  const initH = room?.height_cm ?? presetHeight ?? 0

  const [name,      setName]      = useState(room?.name ?? '')
  const [width,     setWidth]     = useState(initW > 0 ? fromCm(initW, unit).toString() : '')
  const [height,    setHeight]    = useState(initH > 0 ? fromCm(initH, unit).toString() : '')
  const [shapeType, setShapeType] = useState<'rect' | 'L'>(
    initialShapeType ?? (initShape.type === 'poly' || initShape.type === 'polyline' ? 'rect' : initShape.type)
  )
  const [corner,    setCorner]    = useState<RoomCorner>(initShape.type === 'L' ? initShape.corner : 'br')
  const [cutoutW,   setCutoutW]   = useState(initShape.type === 'L' ? fromCm(initShape.cutout_w, unit).toString() : '')
  const [cutoutH,   setCutoutH]   = useState(initShape.type === 'L' ? fromCm(initShape.cutout_h, unit).toString() : '')

  function switchUnit(newUnit: 'cm' | 'mm') {
    const convert = (s: string) => {
      const v = parseFloat(s)
      if (isNaN(v)) return s
      const cm = toCm(v, unit)
      return fromCm(cm, newUnit).toString()
    }
    setWidth(convert(width))
    setHeight(convert(height))
    setCutoutW(convert(cutoutW))
    setCutoutH(convert(cutoutH))
    setUnit(newUnit)
  }

  const wCm  = toCm(parseFloat(width) || 0, unit)
  const hCm  = toCm(parseFloat(height) || 0, unit)
  const cwCm = toCm(parseFloat(cutoutW) || Math.round(wCm * 0.4), unit)
  const chCm = toCm(parseFloat(cutoutH) || Math.round(hCm * 0.4), unit)

  const previewShape: ShapeData = shapeType === 'L'
    ? { type: 'L', cutout_w: cwCm, cutout_h: chCm, corner }
    : { type: 'rect' }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || wCm <= 0 || hCm <= 0) return
    if (shapeType === 'L' && (cwCm <= 0 || chCm <= 0 || cwCm >= wCm || chCm >= hCm)) return
    onSave(name.trim(), wCm, hCm, previewShape)
    onClose()
  }

  const step = stepFor(unit)

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-sm font-semibold text-gray-800">{room ? '공간 수정' : '공간 추가'}</h2>
          <div className="flex items-center gap-3">
            {/* Unit toggle */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {(['cm', 'mm'] as const).map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => switchUnit(u)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    unit === u ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">공간 이름</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="예: 거실, 안방, 큰방, 화장실"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">가로 ({unit})</label>
              <input
                type="number" value={width} onChange={e => setWidth(e.target.value)}
                step={step} min={unit === 'mm' ? 100 : 10}
                placeholder={unit === 'mm' ? '예: 4580' : '예: 458'}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {width && !isNaN(parseFloat(width)) && (
                <p className="text-[10px] text-gray-400 mt-1 pl-1">
                  {unit === 'mm' ? `= ${(toCm(parseFloat(width), unit)).toFixed(1)}cm` : `= ${(parseFloat(width) * 10).toFixed(0)}mm`}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">세로 ({unit})</label>
              <input
                type="number" value={height} onChange={e => setHeight(e.target.value)}
                step={step} min={unit === 'mm' ? 100 : 10}
                placeholder={unit === 'mm' ? '예: 3440' : '예: 344'}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {height && !isNaN(parseFloat(height)) && (
                <p className="text-[10px] text-gray-400 mt-1 pl-1">
                  {unit === 'mm' ? `= ${(toCm(parseFloat(height), unit)).toFixed(1)}cm` : `= ${(parseFloat(height) * 10).toFixed(0)}mm`}
                </p>
              )}
            </div>
          </div>

          {/* Shape type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">방 형태</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'rect' as const, label: '직사각형', icon: (
                  <svg width="18" height="16" viewBox="0 0 18 16" fill="none">
                    <rect x="0.75" y="0.75" width="16.5" height="14.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                )},
                { type: 'L' as const, label: 'L자형', icon: (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <polygon points="0,0 18,0 18,10 10,10 10,18 0,18" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
                  </svg>
                )},
              ].map(({ type, label, icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setShapeType(type)}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    shapeType === type ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-500 hover:border-gray-200'
                  }`}
                >
                  {icon}{label}
                </button>
              ))}
            </div>
          </div>

          {/* L-shape config */}
          {shapeType === 'L' && (
            <div className="bg-gray-50 rounded-2xl p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">빠진 모서리 위치</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['tl', 'tr', 'bl', 'br'] as RoomCorner[]).map(c => {
                    const shape: ShapeData = { type: 'L', cutout_w: cwCm, cutout_h: chCm, corner: c }
                    const w2 = wCm || 300, h2 = hCm || 250
                    const size = 44
                    const aspect = w2 / h2
                    const svgW = aspect >= 1 ? size : size * aspect
                    const svgH = aspect < 1 ? size : size / aspect
                    return (
                      <button
                        key={c} type="button" onClick={() => setCorner(c)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                          corner === c ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 hover:border-gray-200 bg-white'
                        }`}
                      >
                        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
                          <polygon points={getRoomPoints(svgW, svgH, shape)} fill="#eff6ff" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round"/>
                        </svg>
                        <span className={`text-[10px] font-medium ${corner === c ? 'text-indigo-600' : 'text-gray-400'}`}>{CORNER_LABELS[c]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">빠진 부분 가로 ({unit})</label>
                  <input
                    type="number" value={cutoutW} onChange={e => setCutoutW(e.target.value)}
                    step={step} min={step}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">빠진 부분 세로 ({unit})</label>
                  <input
                    type="number" value={cutoutH} onChange={e => setCutoutH(e.target.value)}
                    step={step} min={step}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          {wCm > 0 && hCm > 0 && (
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
              <ShapePreview w={wCm} h={hCm} shape={previewShape} size={72} />
              <div className="text-xs text-gray-500 space-y-0.5">
                <p className="font-semibold text-gray-700">{name || '—'}</p>
                <p>{wCm.toFixed(1)}cm × {hCm.toFixed(1)}cm</p>
                <p className="text-gray-400">{(wCm * 10).toFixed(0)}mm × {(hCm * 10).toFixed(0)}mm</p>
                <p className="text-gray-400">{(wCm / 100).toFixed(2)}m × {(hCm / 100).toFixed(2)}m</p>
              </div>
            </div>
          )}

          <button type="submit"
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium py-3 rounded-xl transition-colors shadow-sm shadow-indigo-200">
            {room ? '수정 완료' : '추가'}
          </button>
        </form>
      </div>
    </div>
  )
}
