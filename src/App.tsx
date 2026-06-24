import { useState, useCallback } from 'react'
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Plus, Share2, Check, Pencil, Trash2, Loader2 } from 'lucide-react'
import { useProject } from './hooks/useProject'
import RoomCanvas from './components/RoomCanvas'
import { snapToGrid } from './lib/utils'
import FurniturePanel from './components/FurniturePanel'
import RoomSettings from './components/RoomSettings'
import type { FurnitureItem, FurnitureTemplate, Room } from './types'

function getShareCode(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('code')
}

export default function App() {
  const shareCode = getShareCode()
  const {
    project,
    rooms,
    activeRoom,
    activeRoomId,
    setActiveRoomId,
    activeItems,
    loading,
    error,
    addRoom,
    updateRoom,
    deleteRoom,
    addItem,
    updateItem,
    deleteItem,
  } = useProject(shareCode)

  const [showRoomModal, setShowRoomModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [copied, setCopied] = useState(false)
  const [activeDragData, setActiveDragData] = useState<{
    type: 'template' | 'item'
    template?: FurnitureTemplate
    item?: FurnitureItem
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragData(event.active.data.current as typeof activeDragData)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragData(null)
      if (!activeRoom) return

      const { active, over, delta } = event
      if (!over || !over.id.toString().startsWith('room-canvas-')) return

      const data = active.data.current as { type: string; template?: FurnitureTemplate; item?: FurnitureItem }

      // Calculate scale
      const scaleW = 720 / activeRoom.width_cm
      const scaleH = 720 / activeRoom.height_cm
      const scale = Math.min(scaleW, scaleH, 2.5)

      if (data.type === 'template' && data.template) {
        // New item dropped from panel
        const canvasEl = document.querySelector(`[data-room-canvas="${activeRoom.id}"]`)
        const rect = canvasEl?.getBoundingClientRect()
        if (!rect) {
          // Fallback: place at center
          const cx = snapToGrid(activeRoom.width_cm / 2 - data.template.width_cm / 2, 10)
          const cy = snapToGrid(activeRoom.height_cm / 2 - data.template.height_cm / 2, 10)
          addItem({
            room_id: activeRoom.id,
            type: data.template.type,
            label: data.template.label,
            x: Math.max(0, cx),
            y: Math.max(0, cy),
            width_cm: data.template.width_cm,
            height_cm: data.template.height_cm,
            rotation: 0,
            color: data.template.color,
          })
          return
        }

        // Place near drop position
        const dropX = snapToGrid(
          Math.max(0, Math.min((event.activatorEvent as PointerEvent).clientX - rect.left - (data.template.width_cm * scale) / 2, activeRoom.width_cm - data.template.width_cm)) / scale,
          10
        )
        const dropY = snapToGrid(
          Math.max(0, Math.min((event.activatorEvent as PointerEvent).clientY - rect.top - (data.template.height_cm * scale) / 2, activeRoom.height_cm - data.template.height_cm)) / scale,
          10
        )

        addItem({
          room_id: activeRoom.id,
          type: data.template.type,
          label: data.template.label,
          x: dropX,
          y: dropY,
          width_cm: data.template.width_cm,
          height_cm: data.template.height_cm,
          rotation: 0,
          color: data.template.color,
        })
      } else if (data.type === 'item' && data.item) {
        // Move existing item
        const item = data.item
        const isRotated = item.rotation === 90 || item.rotation === 270
        const displayW = isRotated ? item.height_cm : item.width_cm
        const displayH = isRotated ? item.width_cm : item.height_cm

        const newX = snapToGrid(
          Math.max(0, Math.min(item.x + delta.x / scale, activeRoom.width_cm - displayW)),
          10
        )
        const newY = snapToGrid(
          Math.max(0, Math.min(item.y + delta.y / scale, activeRoom.height_cm - displayH)),
          10
        )
        updateItem(item.id, { x: newX, y: newY })
      }
    },
    [activeRoom, addItem, updateItem]
  )

  async function handleShare() {
    if (!project) return
    const url = `${window.location.origin}${window.location.pathname}?code=${project.share_code}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="animate-spin" size={28} />
          <p className="text-sm">불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 font-medium">{error}</p>
          <button
            onClick={() => window.history.replaceState(null, '', '/')}
            className="mt-4 text-indigo-500 text-sm hover:underline"
          >
            새 프로젝트 시작
          </button>
        </div>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <header className="h-12 bg-white border-b border-gray-100 flex items-center px-4 gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-base font-semibold text-gray-800">{project?.name ?? '방 배치도'}</span>
          </div>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Share2 size={14} />}
            {copied ? '복사됨!' : '공유 링크'}
          </button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar: furniture panel */}
          <FurniturePanel />

          {/* Main area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Room tabs */}
            <div className="h-10 bg-white border-b border-gray-100 flex items-center px-3 gap-1.5 shrink-0 overflow-x-auto">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => setActiveRoomId(room.id)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm cursor-pointer select-none transition-colors group shrink-0 ${
                    activeRoomId === room.id
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span>{room.name}</span>
                  <span className="text-[10px] text-gray-400 hidden group-hover:inline">
                    {room.width_cm}×{room.height_cm}
                  </span>
                  {rooms.length > 1 && activeRoomId === room.id && (
                    <div className="flex gap-0.5 ml-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingRoom(room)
                          setShowRoomModal(true)
                        }}
                        className="text-indigo-400 hover:text-indigo-600"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`'${room.name}' 방을 삭제할까요?`)) deleteRoom(room.id)
                        }}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={() => {
                  setEditingRoom(null)
                  setShowRoomModal(true)
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-400 hover:bg-gray-50 shrink-0"
              >
                <Plus size={13} /> 방 추가
              </button>
            </div>

            {/* Canvas */}
            {activeRoom ? (
              <div data-room-canvas={activeRoom.id} className="flex-1 overflow-auto">
                <RoomCanvas
                  room={activeRoom}
                  items={activeItems}
                  onUpdateItem={updateItem}
                  onDeleteItem={deleteItem}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                방을 추가해서 시작하세요
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeDragData?.type === 'template' && activeDragData.template && (
          <div
            className="rounded-lg opacity-80 flex items-center justify-center text-white text-xs font-bold shadow-lg"
            style={{
              width: 64,
              height: 40,
              backgroundColor: activeDragData.template.color,
            }}
          >
            {activeDragData.template.label}
          </div>
        )}
      </DragOverlay>

      {/* Room modal */}
      {showRoomModal && (
        <RoomSettings
          room={editingRoom}
          onSave={(name, w, h) => {
            if (editingRoom) {
              updateRoom(editingRoom.id, { name, width_cm: w, height_cm: h })
            } else {
              addRoom(name, w, h)
            }
          }}
          onClose={() => {
            setShowRoomModal(false)
            setEditingRoom(null)
          }}
        />
      )}
    </DndContext>
  )
}
