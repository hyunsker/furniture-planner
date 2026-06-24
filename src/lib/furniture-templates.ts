import type { FurnitureTemplate } from '../types'

export const FURNITURE_TEMPLATES: FurnitureTemplate[] = [
  // 침실
  { type: 'bed-double', label: '더블 침대', width_cm: 150, height_cm: 200, color: '#6366f1', icon: '🛏' },
  { type: 'bed-single', label: '싱글 침대', width_cm: 100, height_cm: 200, color: '#818cf8', icon: '🛏' },
  { type: 'wardrobe', label: '옷장', width_cm: 120, height_cm: 60, color: '#a78bfa', icon: '🚪' },
  { type: 'dresser', label: '화장대', width_cm: 100, height_cm: 45, color: '#c4b5fd', icon: '🪞' },
  // 거실
  { type: 'sofa-3', label: '3인 소파', width_cm: 220, height_cm: 90, color: '#0ea5e9', icon: '🛋' },
  { type: 'sofa-2', label: '2인 소파', width_cm: 160, height_cm: 85, color: '#38bdf8', icon: '🛋' },
  { type: 'tv-stand', label: 'TV 스탠드', width_cm: 150, height_cm: 45, color: '#64748b', icon: '📺' },
  { type: 'coffee-table', label: '커피 테이블', width_cm: 120, height_cm: 60, color: '#475569', icon: '🪑' },
  // 주방/식사
  { type: 'dining-4', label: '4인 식탁', width_cm: 140, height_cm: 80, color: '#f59e0b', icon: '🍽' },
  { type: 'dining-2', label: '2인 식탁', width_cm: 80, height_cm: 80, color: '#fbbf24', icon: '🍽' },
  { type: 'fridge', label: '냉장고', width_cm: 70, height_cm: 75, color: '#94a3b8', icon: '🧊' },
  // 서재/작업
  { type: 'desk', label: '책상', width_cm: 140, height_cm: 70, color: '#10b981', icon: '💻' },
  { type: 'bookshelf', label: '책장', width_cm: 80, height_cm: 30, color: '#059669', icon: '📚' },
  { type: 'chair', label: '의자', width_cm: 55, height_cm: 55, color: '#34d399', icon: '🪑' },
  // 욕실
  { type: 'bathtub', label: '욕조', width_cm: 170, height_cm: 75, color: '#0891b2', icon: '🛁' },
  { type: 'toilet', label: '변기', width_cm: 40, height_cm: 65, color: '#e2e8f0', icon: '🚽' },
  { type: 'sink', label: '세면대', width_cm: 60, height_cm: 50, color: '#cbd5e1', icon: '🚿' },
  // 기타
  { type: 'plant', label: '화분', width_cm: 40, height_cm: 40, color: '#22c55e', icon: '🪴' },
  { type: 'washing-machine', label: '세탁기', width_cm: 60, height_cm: 60, color: '#94a3b8', icon: '🫧' },
]

export const FURNITURE_CATEGORIES = [
  { key: 'bedroom', label: '침실', types: ['bed-double', 'bed-single', 'wardrobe', 'dresser'] },
  { key: 'living', label: '거실', types: ['sofa-3', 'sofa-2', 'tv-stand', 'coffee-table'] },
  { key: 'kitchen', label: '주방', types: ['dining-4', 'dining-2', 'fridge'] },
  { key: 'study', label: '서재', types: ['desk', 'bookshelf', 'chair'] },
  { key: 'bathroom', label: '욕실', types: ['bathtub', 'toilet', 'sink'] },
  { key: 'etc', label: '기타', types: ['plant', 'washing-machine'] },
]
