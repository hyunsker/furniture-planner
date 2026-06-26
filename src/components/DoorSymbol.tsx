import type { DoorType, DoorWall, DoorItem } from '../types'
export type { DoorType, DoorWall, DoorItem }

interface Props {
  door: DoorItem
  roomW: number   // px
  roomH: number   // px
  stroke?: string
}

/** Renders a door symbol in the room SVG coordinate space (pixels). */
export default function DoorSymbol({ door, roomW, roomH, stroke = '#334155' }: Props) {
  const { wall, position, widthCm, type, flip } = door

  // Wall length in px
  const wallLen = wall === 'top' || wall === 'bottom' ? roomW : roomH
  const dw = widthCm  // door width in SVG units – caller should pass already-scaled

  // Position of door start along the wall (px)
  const pos = wallLen * position

  // We build the symbol as if on the 'bottom' wall (y = roomH), then rotate
  // Hinge is at x=pos (or x=pos+dw if flipped)
  const hingeX = flip ? pos + dw : pos
  const freeX  = flip ? pos : pos + dw
  const wallY  = 0  // local y at wall edge; we'll translate into room coords later

  let symContent: React.ReactNode
  if (type === 'swing') {
    const sweepY = -dw                      // inward (negative = into room interior)
    const largeArc = 0
    const sweep = flip ? 0 : 1
    symContent = (
      <g>
        {/* Wall break (white fill to erase wall line) */}
        <rect x={Math.min(hingeX, freeX)} y={-2} width={dw} height={4} fill="white" />
        {/* Door leaf */}
        <line x1={hingeX} y1={wallY} x2={hingeX} y2={sweepY} stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
        {/* Swing arc */}
        <path
          d={`M ${hingeX} ${sweepY} A ${dw} ${dw} 0 ${largeArc} ${sweep} ${freeX} ${wallY}`}
          fill="none" stroke={stroke} strokeWidth={1} strokeDasharray="4,3"
        />
        {/* Opening markers */}
        <line x1={Math.min(hingeX, freeX)} y1={-2} x2={Math.min(hingeX, freeX)} y2={2} stroke={stroke} strokeWidth={1.5} />
        <line x1={Math.max(hingeX, freeX)} y1={-2} x2={Math.max(hingeX, freeX)} y2={2} stroke={stroke} strokeWidth={1.5} />
      </g>
    )
  } else if (type === 'sliding') {
    const panel = dw * 0.6
    symContent = (
      <g>
        <rect x={Math.min(hingeX, freeX)} y={-2} width={dw} height={4} fill="white" />
        <rect x={pos} y={-3} width={panel} height={3} fill="white" stroke={stroke} strokeWidth={1} />
        <rect x={pos + dw - panel} y={0} width={panel} height={3} fill="white" stroke={stroke} strokeWidth={1} />
        <line x1={pos} y1={-2} x2={pos} y2={2} stroke={stroke} strokeWidth={1.5} />
        <line x1={pos + dw} y1={-2} x2={pos + dw} y2={2} stroke={stroke} strokeWidth={1.5} />
      </g>
    )
  } else {
    // Folding door
    const third = dw / 3
    symContent = (
      <g>
        <rect x={Math.min(hingeX, freeX)} y={-2} width={dw} height={4} fill="white" />
        <polyline
          points={`${pos},0 ${pos + third},-${third * 0.7} ${pos + third * 2},0 ${pos + dw},-${third * 0.7}`}
          fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round"
        />
        <line x1={pos} y1={-2} x2={pos} y2={2} stroke={stroke} strokeWidth={1.5} />
        <line x1={pos + dw} y1={-2} x2={pos + dw} y2={2} stroke={stroke} strokeWidth={1.5} />
      </g>
    )
  }

  // Rotate transform to place on the correct wall
  const transforms: Record<DoorWall, string> = {
    bottom: `translate(0, ${roomH})`,
    top:    `translate(${roomW}, 0) rotate(180)`,
    right:  `translate(${roomW}, 0) rotate(90)`,
    left:   `translate(0, ${roomH}) rotate(270)`,
  }

  return (
    <g transform={transforms[wall]}>
      {symContent}
    </g>
  )
}
