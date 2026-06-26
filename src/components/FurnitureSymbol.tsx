interface Props {
  type: string
  w: number
  h: number
  stroke?: string
  strokeWidth?: number
}

export default function FurnitureSymbol({ type, w, h, stroke = '#334155', strokeWidth = 1.5 }: Props) {
  const sw = strokeWidth
  const base = type.split('-')[0]

  /* ── SOFA ─────────────────────────────────────────────────────────────── */
  if (base === 'sofa') {
    const backH   = h * 0.34
    const armW    = w * 0.13
    const innerW  = w - armW * 2
    const seatH   = h - backH
    const cushions = type === 'sofa-3' ? 3 : type === 'sofa-2' ? 2 : 1
    const r = Math.min(4, w * 0.03)

    return (
      <g>
        {/* Back rest – full width, thicker look */}
        <rect x={0} y={0} width={w} height={backH} rx={r} fill="none" stroke={stroke} strokeWidth={sw * 1.1} />
        {/* Seat surface */}
        <rect x={armW} y={backH} width={innerW} height={seatH} rx={r * 0.6} fill="none" stroke={stroke} strokeWidth={sw} />
        {/* Left armrest */}
        <rect x={0} y={backH} width={armW} height={seatH} rx={r * 0.5} fill="none" stroke={stroke} strokeWidth={sw} />
        {/* Right armrest */}
        <rect x={w - armW} y={backH} width={armW} height={seatH} rx={r * 0.5} fill="none" stroke={stroke} strokeWidth={sw} />
        {/* Cushion dividers */}
        {Array.from({ length: cushions - 1 }, (_, i) => (
          <line
            key={i}
            x1={armW + (innerW * (i + 1)) / cushions}
            y1={backH + seatH * 0.08}
            x2={armW + (innerW * (i + 1)) / cushions}
            y2={h - seatH * 0.08}
            stroke={stroke}
            strokeWidth={sw * 0.6}
            strokeDasharray={`${sw * 3},${sw * 2}`}
          />
        ))}
        {/* Back cushion fill line – shows the "cushion" area inside back rest */}
        <rect
          x={armW * 0.5}
          y={backH * 0.2}
          width={w - armW}
          height={backH * 0.6}
          rx={r * 0.4}
          fill="none"
          stroke={stroke}
          strokeWidth={sw * 0.5}
          strokeOpacity={0.5}
        />
      </g>
    )
  }

  /* ── BED ──────────────────────────────────────────────────────────────── */
  if (base === 'bed') {
    const isDouble = type !== 'bed-single'
    const headH  = h * 0.09
    const pillowH = h * 0.15
    const pad = w * 0.07

    return (
      <g>
        <rect x={0} y={0} width={w} height={h} rx={4} fill="none" stroke={stroke} strokeWidth={sw} />
        {/* Headboard */}
        <rect x={0} y={0} width={w} height={headH} rx={3} fill="none" stroke={stroke} strokeWidth={sw * 1.1} />
        {/* Pillows */}
        {isDouble ? (
          <>
            <rect x={pad} y={headH + pad} width={(w - pad * 3) / 2} height={pillowH} rx={7} fill="none" stroke={stroke} strokeWidth={sw * 0.8} />
            <rect x={pad * 2 + (w - pad * 3) / 2} y={headH + pad} width={(w - pad * 3) / 2} height={pillowH} rx={7} fill="none" stroke={stroke} strokeWidth={sw * 0.8} />
          </>
        ) : (
          <rect x={pad} y={headH + pad} width={w - pad * 2} height={pillowH} rx={7} fill="none" stroke={stroke} strokeWidth={sw * 0.8} />
        )}
        {/* Blanket fold */}
        <line x1={pad} y1={headH + pad + pillowH + 6} x2={w - pad} y2={headH + pad + pillowH + 6} stroke={stroke} strokeWidth={sw * 0.5} strokeDasharray="6,4" />
      </g>
    )
  }

  /* ── DINING TABLE ─────────────────────────────────────────────────────── */
  if (base === 'dining') {
    const num = parseInt(type.split('-')[1]) || 4
    const cr = Math.min(w, h) * 0.1
    const tw = w - cr * 4; const th = h - cr * 4
    const tx = cr * 2;    const ty = cr * 2

    type Chair = { cx: number; cy: number; rx: number; ry: number }
    const chairs: Chair[] = []

    if (num <= 2) {
      chairs.push({ cx: tx + tw / 2, cy: ty - cr * 0.5, rx: cr * 1.3, ry: cr * 0.85 })
      chairs.push({ cx: tx + tw / 2, cy: ty + th + cr * 0.5, rx: cr * 1.3, ry: cr * 0.85 })
    } else if (num === 4) {
      chairs.push({ cx: tx + tw / 2, cy: ty - cr * 0.5, rx: cr * 1.3, ry: cr * 0.85 })
      chairs.push({ cx: tx + tw / 2, cy: ty + th + cr * 0.5, rx: cr * 1.3, ry: cr * 0.85 })
      chairs.push({ cx: tx - cr * 0.5, cy: ty + th / 2, rx: cr * 0.85, ry: cr * 1.3 })
      chairs.push({ cx: tx + tw + cr * 0.5, cy: ty + th / 2, rx: cr * 0.85, ry: cr * 1.3 })
    } else {
      chairs.push({ cx: tx + tw * 0.28, cy: ty - cr * 0.5, rx: cr * 1.1, ry: cr * 0.8 })
      chairs.push({ cx: tx + tw * 0.72, cy: ty - cr * 0.5, rx: cr * 1.1, ry: cr * 0.8 })
      chairs.push({ cx: tx + tw * 0.28, cy: ty + th + cr * 0.5, rx: cr * 1.1, ry: cr * 0.8 })
      chairs.push({ cx: tx + tw * 0.72, cy: ty + th + cr * 0.5, rx: cr * 1.1, ry: cr * 0.8 })
      chairs.push({ cx: tx - cr * 0.5, cy: ty + th / 2, rx: cr * 0.8, ry: cr * 1.1 })
      chairs.push({ cx: tx + tw + cr * 0.5, cy: ty + th / 2, rx: cr * 0.8, ry: cr * 1.1 })
    }

    return (
      <g>
        <rect x={tx} y={ty} width={tw} height={th} rx={3} fill="none" stroke={stroke} strokeWidth={sw} />
        {chairs.map((c, i) => (
          <ellipse key={i} cx={c.cx} cy={c.cy} rx={c.rx} ry={c.ry} fill="none" stroke={stroke} strokeWidth={sw * 0.8} />
        ))}
      </g>
    )
  }

  /* ── TOILET ───────────────────────────────────────────────────────────── */
  if (type === 'toilet') {
    return (
      <g>
        <rect x={w * 0.1} y={0} width={w * 0.8} height={h * 0.35} rx={3} fill="none" stroke={stroke} strokeWidth={sw} />
        <ellipse cx={w / 2} cy={h * 0.68} rx={w * 0.44} ry={h * 0.3} fill="none" stroke={stroke} strokeWidth={sw} />
        <ellipse cx={w / 2} cy={h * 0.68} rx={w * 0.36} ry={h * 0.24} fill="none" stroke={stroke} strokeWidth={sw * 0.7} />
        <circle cx={w / 2} cy={h * 0.18} r={Math.min(w, h) * 0.06} fill="none" stroke={stroke} strokeWidth={sw * 0.7} />
      </g>
    )
  }

  /* ── SINK ─────────────────────────────────────────────────────────────── */
  if (type === 'sink') {
    return (
      <g>
        <rect x={0} y={0} width={w} height={h} rx={4} fill="none" stroke={stroke} strokeWidth={sw} />
        <ellipse cx={w / 2} cy={h / 2} rx={w * 0.34} ry={h * 0.34} fill="none" stroke={stroke} strokeWidth={sw} />
        <circle cx={w / 2} cy={h * 0.36} r={Math.min(w, h) * 0.07} fill="none" stroke={stroke} strokeWidth={sw * 0.8} />
        <line x1={w / 2} y1={h * 0.36} x2={w / 2} y2={h / 2 - h * 0.05} stroke={stroke} strokeWidth={sw * 0.6} />
      </g>
    )
  }

  /* ── BATHTUB ──────────────────────────────────────────────────────────── */
  if (type === 'bathtub') {
    return (
      <g>
        <rect x={0} y={0} width={w} height={h} rx={h * 0.28} fill="none" stroke={stroke} strokeWidth={sw} />
        <rect x={w * 0.07} y={h * 0.12} width={w * 0.86} height={h * 0.76} rx={h * 0.22} fill="none" stroke={stroke} strokeWidth={sw * 0.7} />
        <circle cx={w * 0.15} cy={h * 0.25} r={Math.min(w, h) * 0.055} fill="none" stroke={stroke} strokeWidth={sw * 0.8} />
        <circle cx={w * 0.15} cy={h * 0.42} r={Math.min(w, h) * 0.042} fill="none" stroke={stroke} strokeWidth={sw * 0.7} />
      </g>
    )
  }

  /* ── WASHING MACHINE ──────────────────────────────────────────────────── */
  if (type === 'washing-machine') {
    const r = Math.min(w, h) * 0.36
    return (
      <g>
        <rect x={0} y={0} width={w} height={h} rx={4} fill="none" stroke={stroke} strokeWidth={sw} />
        <line x1={w * 0.12} y1={h * 0.1} x2={w * 0.45} y2={h * 0.1} stroke={stroke} strokeWidth={sw * 0.6} />
        <circle cx={w / 2} cy={h * 0.56} r={r} fill="none" stroke={stroke} strokeWidth={sw} />
        <circle cx={w / 2} cy={h * 0.56} r={r * 0.55} fill="none" stroke={stroke} strokeWidth={sw * 0.7} />
      </g>
    )
  }

  /* ── FRIDGE ───────────────────────────────────────────────────────────── */
  if (type === 'fridge') {
    return (
      <g>
        <rect x={0} y={0} width={w} height={h} rx={3} fill="none" stroke={stroke} strokeWidth={sw} />
        <line x1={w * 0.07} y1={h * 0.4} x2={w * 0.93} y2={h * 0.4} stroke={stroke} strokeWidth={sw * 0.7} />
        <line x1={w * 0.14} y1={h * 0.14} x2={w * 0.14} y2={h * 0.3} stroke={stroke} strokeWidth={sw * 1.1} strokeLinecap="round" />
        <line x1={w * 0.14} y1={h * 0.5} x2={w * 0.14} y2={h * 0.72} stroke={stroke} strokeWidth={sw * 1.1} strokeLinecap="round" />
      </g>
    )
  }

  /* ── WARDROBE ─────────────────────────────────────────────────────────── */
  if (type === 'wardrobe') {
    const doors = w > 115 ? 3 : 2
    return (
      <g>
        <rect x={0} y={0} width={w} height={h} rx={2} fill="none" stroke={stroke} strokeWidth={sw} />
        {Array.from({ length: doors - 1 }, (_, i) => (
          <line key={i} x1={w * (i + 1) / doors} y1={0} x2={w * (i + 1) / doors} y2={h} stroke={stroke} strokeWidth={sw * 0.6} />
        ))}
        {Array.from({ length: doors }, (_, i) => (
          <circle key={i} cx={w * (i + 0.5) / doors + w / doors * 0.28} cy={h * 0.5} r={Math.min(w / doors, h) * 0.06} fill={stroke} />
        ))}
      </g>
    )
  }

  /* ── DRESSER ──────────────────────────────────────────────────────────── */
  if (type === 'dresser') {
    return (
      <g>
        <rect x={0} y={0} width={w} height={h} rx={2} fill="none" stroke={stroke} strokeWidth={sw} />
        <line x1={0} y1={h * 0.5} x2={w} y2={h * 0.5} stroke={stroke} strokeWidth={sw * 0.6} />
        <line x1={0} y1={h * 0.25} x2={w} y2={h * 0.25} stroke={stroke} strokeWidth={sw * 0.6} />
        {/* Mirror (dashed outline above) */}
        <rect x={w * 0.12} y={-h * 0.72} width={w * 0.76} height={h * 0.66} rx={3} fill="none" stroke={stroke} strokeWidth={sw * 0.7} strokeDasharray="4,3" />
      </g>
    )
  }

  /* ── DESK ─────────────────────────────────────────────────────────────── */
  if (type === 'desk') {
    return (
      <g>
        <rect x={0} y={0} width={w} height={h} rx={2} fill="none" stroke={stroke} strokeWidth={sw} />
        <rect x={w * 0.72} y={h * 0.1} width={w * 0.2} height={h * 0.8} rx={2} fill="none" stroke={stroke} strokeWidth={sw * 0.7} />
        <line x1={w * 0.72} y1={h * 0.5} x2={w * 0.92} y2={h * 0.5} stroke={stroke} strokeWidth={sw * 0.5} />
        <line x1={w * 0.79} y1={h * 0.26} x2={w * 0.85} y2={h * 0.26} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <line x1={w * 0.79} y1={h * 0.67} x2={w * 0.85} y2={h * 0.67} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </g>
    )
  }

  /* ── BOOKSHELF ────────────────────────────────────────────────────────── */
  if (type === 'bookshelf') {
    const shelves = 4
    return (
      <g>
        <rect x={0} y={0} width={w} height={h} rx={2} fill="none" stroke={stroke} strokeWidth={sw} />
        {Array.from({ length: shelves - 1 }, (_, i) => (
          <line key={i} x1={2} y1={(h / shelves) * (i + 1)} x2={w - 2} y2={(h / shelves) * (i + 1)} stroke={stroke} strokeWidth={sw * 0.5} />
        ))}
      </g>
    )
  }

  /* ── TV STAND ─────────────────────────────────────────────────────────── */
  if (type === 'tv') {
    return (
      <g>
        <rect x={0} y={0} width={w} height={h} rx={2} fill="none" stroke={stroke} strokeWidth={sw} />
        <rect x={w * 0.04} y={h * 0.12} width={w * 0.92} height={h * 0.76} fill="none" stroke={stroke} strokeWidth={sw * 0.6} />
        <line x1={w * 0.3} y1={h * 0.55} x2={w * 0.7} y2={h * 0.55} stroke={stroke} strokeWidth={sw * 0.4} strokeOpacity={0.5} />
      </g>
    )
  }

  /* ── COFFEE TABLE ─────────────────────────────────────────────────────── */
  if (type === 'coffee-table') {
    return (
      <g>
        <rect x={0} y={0} width={w} height={h} rx={4} fill="none" stroke={stroke} strokeWidth={sw} />
        <rect x={w * 0.07} y={h * 0.12} width={w * 0.86} height={h * 0.76} rx={3} fill="none" stroke={stroke} strokeWidth={sw * 0.6} />
      </g>
    )
  }

  /* ── CHAIR ────────────────────────────────────────────────────────────── */
  if (type === 'chair') {
    const backH = h * 0.28
    return (
      <g>
        <rect x={0} y={0} width={w} height={backH} rx={3} fill="none" stroke={stroke} strokeWidth={sw} />
        <rect x={w * 0.06} y={backH} width={w * 0.88} height={h - backH} rx={3} fill="none" stroke={stroke} strokeWidth={sw} />
      </g>
    )
  }

  /* ── DEFAULT ──────────────────────────────────────────────────────────── */
  return (
    <g>
      <rect x={0} y={0} width={w} height={h} rx={3} fill="none" stroke={stroke} strokeWidth={sw} />
      <line x1={w * 0.15} y1={h * 0.15} x2={w * 0.85} y2={h * 0.85} stroke={stroke} strokeWidth={sw * 0.5} strokeOpacity={0.35} />
      <line x1={w * 0.85} y1={h * 0.15} x2={w * 0.15} y2={h * 0.85} stroke={stroke} strokeWidth={sw * 0.5} strokeOpacity={0.35} />
    </g>
  )
}
