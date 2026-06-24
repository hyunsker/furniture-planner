export interface Project {
  id: string
  name: string
  share_code: string
  created_at: string
}

export interface Room {
  id: string
  project_id: string
  name: string
  width_cm: number
  height_cm: number
  order_index: number
}

export interface FurnitureItem {
  id: string
  room_id: string
  type: string
  label: string
  x: number
  y: number
  width_cm: number
  height_cm: number
  rotation: number
  color: string
}

export interface FurnitureTemplate {
  type: string
  label: string
  width_cm: number
  height_cm: number
  color: string
  icon: string
}
