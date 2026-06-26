export type FurnitureVariant = {
  id: string
  label: string
  w: number  // cm
  h: number  // cm
}

export type FurnitureType = {
  category: string
  name: string
  icon: string  // simple text symbol for panel
  variants: FurnitureVariant[]
}

export const FURNITURE_LIBRARY: FurnitureType[] = [
  {
    category: '거실',
    name: '소파',
    icon: '⬛',
    variants: [
      { id: 'sofa-1', label: '1인용', w: 90,  h: 90  },
      { id: 'sofa-2', label: '2인용', w: 160, h: 90  },
      { id: 'sofa-3', label: '3인용', w: 220, h: 90  },
    ],
  },
  {
    category: '거실',
    name: 'TV 스탠드',
    icon: '▬',
    variants: [
      { id: 'tv', label: '110cm', w: 110, h: 40 },
      { id: 'tv', label: '150cm', w: 150, h: 45 },
      { id: 'tv', label: '200cm', w: 200, h: 45 },
    ],
  },
  {
    category: '거실',
    name: '커피 테이블',
    icon: '□',
    variants: [
      { id: 'coffee-table', label: '소형',  w: 80,  h: 50 },
      { id: 'coffee-table', label: '중형',  w: 110, h: 60 },
      { id: 'coffee-table', label: '대형',  w: 140, h: 70 },
    ],
  },
  {
    category: '침실',
    name: '침대',
    icon: '▭',
    variants: [
      { id: 'bed-single', label: '싱글 (100)',  w: 100, h: 200 },
      { id: 'bed-double', label: '더블 (150)',  w: 150, h: 200 },
      { id: 'bed-queen',  label: '퀸 (160)',    w: 160, h: 200 },
      { id: 'bed-king',   label: '킹 (180)',    w: 180, h: 200 },
    ],
  },
  {
    category: '침실',
    name: '옷장',
    icon: '▮',
    variants: [
      { id: 'wardrobe', label: '2도어 (90)',  w: 90,  h: 60 },
      { id: 'wardrobe', label: '3도어 (135)', w: 135, h: 60 },
      { id: 'wardrobe', label: '4도어 (180)', w: 180, h: 60 },
    ],
  },
  {
    category: '침실',
    name: '화장대',
    icon: '▭',
    variants: [
      { id: 'dresser', label: '소형', w: 80,  h: 45 },
      { id: 'dresser', label: '대형', w: 110, h: 45 },
    ],
  },
  {
    category: '주방',
    name: '식탁',
    icon: '⬜',
    variants: [
      { id: 'dining-2', label: '2인용',  w: 80,  h: 80  },
      { id: 'dining-4', label: '4인용',  w: 140, h: 80  },
      { id: 'dining-6', label: '6인용',  w: 200, h: 90  },
    ],
  },
  {
    category: '주방',
    name: '냉장고',
    icon: '▯',
    variants: [
      { id: 'fridge', label: '일반형', w: 70,  h: 75 },
      { id: 'fridge', label: '양문형', w: 90,  h: 75 },
    ],
  },
  {
    category: '서재',
    name: '책상',
    icon: '▭',
    variants: [
      { id: 'desk', label: '소형 (100)', w: 100, h: 60 },
      { id: 'desk', label: '중형 (140)', w: 140, h: 70 },
      { id: 'desk', label: '대형 (180)', w: 180, h: 80 },
    ],
  },
  {
    category: '서재',
    name: '책장',
    icon: '▮',
    variants: [
      { id: 'bookshelf', label: '60cm', w: 60,  h: 30 },
      { id: 'bookshelf', label: '90cm', w: 90,  h: 30 },
      { id: 'bookshelf', label: '120cm', w: 120, h: 30 },
    ],
  },
  {
    category: '욕실',
    name: '욕조',
    icon: '⬜',
    variants: [
      { id: 'bathtub', label: '일반형', w: 150, h: 75 },
      { id: 'bathtub', label: '대형',   w: 170, h: 80 },
    ],
  },
  {
    category: '욕실',
    name: '변기',
    icon: '○',
    variants: [
      { id: 'toilet', label: '일반형', w: 40, h: 70 },
    ],
  },
  {
    category: '욕실',
    name: '세면대',
    icon: '○',
    variants: [
      { id: 'sink', label: '일반형', w: 60, h: 50 },
      { id: 'sink', label: '대형',   w: 80, h: 55 },
    ],
  },
  {
    category: '기타',
    name: '세탁기',
    icon: '○',
    variants: [
      { id: 'washing-machine', label: '일반형', w: 60, h: 60 },
    ],
  },
  {
    category: '기타',
    name: '의자',
    icon: '□',
    variants: [
      { id: 'chair', label: '일반형', w: 50, h: 55 },
    ],
  },
]

export const FURNITURE_CATEGORIES = ['거실', '침실', '주방', '서재', '욕실', '기타']
