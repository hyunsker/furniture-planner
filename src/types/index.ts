export interface Project {
  id: string
  name: string
  share_code: string
  apt_w: number
  apt_h: number
  created_at: string
}

export type RoomCorner = 'tl' | 'tr' | 'bl' | 'br'

export type ShapeData =
  | { type: 'rect' }
  | { type: 'L'; cutout_w: number; cutout_h: number; corner: RoomCorner }
  | { type: 'poly'; points: { x: number; y: number }[] }
  | { type: 'polyline'; points: { x: number; y: number }[] }  // open walls (not closed)

export interface Room {
  id: string
  project_id: string
  name: string
  width_cm: number
  height_cm: number
  x_cm: number
  y_cm: number
  color: string
  order_index: number
  shape_data: ShapeData
}

/** Returns SVG polygon points string for a room shape (in given w×h coordinate space) */
export function getRoomPoints(w: number, h: number, shape: ShapeData): string {
  if (!shape || shape.type === 'rect') {
    return `0,0 ${w},0 ${w},${h} 0,${h}`
  }
  if (shape.type === 'poly' || shape.type === 'polyline') {
    return shape.points.map(p => `${p.x},${p.y}`).join(' ')
  }
  const { cutout_w: cw, cutout_h: ch, corner } = shape
  switch (corner) {
    case 'tl': return `${cw},0 ${w},0 ${w},${h} 0,${h} 0,${ch} ${cw},${ch}`
    case 'tr': return `0,0 ${w - cw},0 ${w - cw},${ch} ${w},${ch} ${w},${h} 0,${h}`
    case 'bl': return `0,0 ${w},0 ${w},${h} ${cw},${h} ${cw},${h - ch} 0,${h - ch}`
    case 'br': return `0,0 ${w},0 ${w},${h - ch} ${w - cw},${h - ch} ${w - cw},${h} 0,${h}`
  }
}
