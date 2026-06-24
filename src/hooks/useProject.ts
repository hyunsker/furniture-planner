import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Project, Room, FurnitureItem } from '../types'

export function useProject(shareCode: string | null) {
  const [project, setProject] = useState<Project | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [items, setItems] = useState<FurnitureItem[]>([])
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load or create project
  useEffect(() => {
    if (shareCode) {
      loadProject(shareCode)
    } else {
      createProject()
    }
  }, [shareCode])

  async function loadProject(code: string) {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('share_code', code)
      .single()

    if (error || !data) {
      setError('프로젝트를 찾을 수 없습니다.')
      setLoading(false)
      return
    }

    setProject(data)
    await loadRooms(data.id)
    setLoading(false)
  }

  async function createProject() {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .insert({ name: '우리 집 배치도' })
      .select()
      .single()

    if (error || !data) {
      setError('프로젝트 생성 실패')
      setLoading(false)
      return
    }

    setProject(data)
    // Create a default room
    const { data: room } = await supabase
      .from('rooms')
      .insert({ project_id: data.id, name: '안방', width_cm: 400, height_cm: 350, order_index: 0 })
      .select()
      .single()

    if (room) {
      setRooms([room])
      setActiveRoomId(room.id)
    }

    // Redirect to share URL
    window.history.replaceState(null, '', `?code=${data.share_code}`)
    setLoading(false)
  }

  async function loadRooms(projectId: string) {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index')

    if (data && data.length > 0) {
      setRooms(data)
      setActiveRoomId(data[0].id)
      await loadItems(data.map((r) => r.id))
    }
  }

  async function loadItems(roomIds: string[]) {
    const { data } = await supabase
      .from('furniture_items')
      .select('*')
      .in('room_id', roomIds)

    if (data) setItems(data)
  }

  // Realtime subscriptions
  useEffect(() => {
    if (!project) return

    const channel = supabase
      .channel(`project-${project.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'furniture_items' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setItems((prev) => [...prev, payload.new as FurnitureItem])
          } else if (payload.eventType === 'UPDATE') {
            setItems((prev) =>
              prev.map((item) =>
                item.id === (payload.new as FurnitureItem).id ? (payload.new as FurnitureItem) : item
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setItems((prev) => prev.filter((item) => item.id !== (payload.old as FurnitureItem).id))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRooms((prev) => [...prev, payload.new as Room])
          } else if (payload.eventType === 'UPDATE') {
            setRooms((prev) =>
              prev.map((r) => (r.id === (payload.new as Room).id ? (payload.new as Room) : r))
            )
          } else if (payload.eventType === 'DELETE') {
            setRooms((prev) => prev.filter((r) => r.id !== (payload.old as Room).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [project])

  // CRUD operations
  async function addRoom(name: string, width_cm: number, height_cm: number) {
    if (!project) return
    const { data } = await supabase
      .from('rooms')
      .insert({ project_id: project.id, name, width_cm, height_cm, order_index: rooms.length })
      .select()
      .single()
    if (data) setActiveRoomId(data.id)
  }

  async function updateRoom(id: string, updates: Partial<Room>) {
    await supabase.from('rooms').update(updates).eq('id', id)
  }

  async function deleteRoom(id: string) {
    await supabase.from('rooms').delete().eq('id', id)
    if (activeRoomId === id) {
      const remaining = rooms.filter((r) => r.id !== id)
      setActiveRoomId(remaining[0]?.id ?? null)
    }
  }

  async function addItem(item: Omit<FurnitureItem, 'id' | 'created_at' | 'updated_at'>) {
    await supabase.from('furniture_items').insert(item)
  }

  async function updateItem(id: string, updates: Partial<FurnitureItem>) {
    await supabase.from('furniture_items').update(updates).eq('id', id)
  }

  async function deleteItem(id: string) {
    await supabase.from('furniture_items').delete().eq('id', id)
  }

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null
  const activeItems = items.filter((i) => i.room_id === activeRoomId)

  return {
    project,
    rooms,
    items,
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
  }
}
