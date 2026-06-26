import { useState } from 'react'
import FurnitureSymbol from './FurnitureSymbol'

type Kind = {
  typeId: string
  name: string
  icon: string
  presets: number[]   // mm width guides
  equalDepth: boolean // swing door: depth follows width
  depth: number       // mm depth when not equalDepth
}

const KINDS: Kind[] = [
  { typeId: 'door',       name: '여닫이문', icon: '🚪', presets: [700, 800, 900, 1000], equalDepth: true,  depth: 0   },
  { typeId: 'door-slide', name: '미닫이문', icon: '🚪', presets: [1200, 1500, 1800],     equalDepth: false, depth: 200 },
  { typeId: 'window',     name: '창문',     icon: '🪟', presets: [900, 1200, 1500, 1800], equalDepth: false, depth: 180 },
]

interface Props {
  activeKey: string | null  // `${typeId}:${mmWidth}` of the item currently being placed
  onPick: (typeId: string, name: string, wCm: number, hCm: number) => void
}

export default function DoorPanel({ activeKey, onPick }: Props) {
  const [custom, setCustom] = useState<Record<string, string>>({})

  return (
    <div className="px-2 pb-3 space-y-2.5">
      <p className="text-[11px] text-gray-400 px-1 leading-relaxed">
        크기를 고르거나 직접 입력한 뒤, 도면의 방을 클릭해 배치하세요.
      </p>
      {KINDS.map(k => {
        const place = (mm: number) => {
          const wCm = mm / 10
          const hCm = k.equalDepth ? wCm : k.depth / 10
          onPick(k.typeId, k.name, wCm, hCm)
        }
        const cw = custom[k.typeId] ?? ''
        const previewW = 90, previewH = k.equalDepth ? 90 : 24
        return (
          <div key={k.typeId} className="rounded-xl border border-gray-100 p-2.5 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">{k.icon}</span>
              <span className="text-[13px] font-semibold text-gray-700">{k.name}</span>
              <div className="ml-auto w-9 h-7 flex items-center justify-center">
                <svg width={26} height={k.equalDepth ? 26 : 14} viewBox={`0 0 ${previewW} ${previewH}`} preserveAspectRatio="xMidYMid meet">
                  <FurnitureSymbol type={k.typeId} w={previewW} h={previewH} stroke="#6366f1" strokeWidth={4} />
                </svg>
              </div>
            </div>

            {/* preset width guides */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {k.presets.map(p => {
                const active = activeKey === `${k.typeId}:${p}`
                return (
                  <button
                    key={p}
                    onClick={() => place(p)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      active ? 'bg-indigo-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-indigo-100'
                    }`}
                  >{p}mm</button>
                )
              })}
            </div>

            {/* custom width */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center flex-1 border border-gray-200 rounded-lg overflow-hidden">
                <input
                  type="number"
                  min={300}
                  step={5}
                  value={cw}
                  placeholder="직접 입력"
                  onChange={e => setCustom(c => ({ ...c, [k.typeId]: e.target.value }))}
                  className="flex-1 w-0 text-[13px] text-center py-1.5 outline-none"
                />
                <span className="px-2 text-[11px] text-gray-400 bg-gray-50 border-l border-gray-200 py-1.5">mm</span>
              </div>
              <button
                onClick={() => { const v = parseFloat(cw); if (!isNaN(v) && v >= 100) place(Math.round(v)) }}
                className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-[11px] font-semibold transition-colors"
              >배치</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
