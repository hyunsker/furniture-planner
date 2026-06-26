import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Project, Room, ShapeData, RoomCorner } from '../types'

const COLORS = ['blue', 'green', 'purple', 'yellow', 'cyan', 'orange', 'pink']

export function useProject(shareCode: string | null) {
  const [project, setProject] = useState<Project | null>(null)
  const [rooms, setRooms]     = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // Undo history (snapshots of the rooms array taken before each edit)
  const roomsRef = useRef<Room[]>([])
  const historyRef = useRef<Room[][]>([])
  const [canUndo, setCanUndo] = useState(false)
  useEffect(() => { roomsRef.current = rooms }, [rooms])

  function snapshot() {
    historyRef.current = [...historyRef.current.slice(-40), roomsRef.current.map(r => ({ ...r }))]
    setCanUndo(true)
  }

  async function undo() {
    const hist = historyRef.current
    if (hist.length === 0) return
    const prev = hist[hist.length - 1]
    historyRef.current = hist.slice(0, -1)
    setCanUndo(historyRef.current.length > 0)
    const cur = roomsRef.current
    setRooms(prev)  // optimistic local restore
    // Reconcile DB: delete removed rooms, upsert the rest back to snapshot state
    for (const r of cur) {
      if (!prev.find(p => p.id === r.id)) await supabase.from('rooms').delete().eq('id', r.id)
    }
    for (const p of prev) await supabase.from('rooms').upsert(p)
  }

  useEffect(() => {
    if (shareCode) loadProject(shareCode)
    else createProject()
  }, [shareCode])

  async function loadProject(code: string) {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects').select('*').eq('share_code', code).single()
    if (error || !data) { setError('프로젝트를 찾을 수 없습니다.'); setLoading(false); return }
    setProject(data)
    await loadRooms(data.id)
    setLoading(false)
  }

  async function createProject() {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .insert({ name: '우리 집 배치도', apt_w: 1500, apt_h: 1200 })
      .select().single()
    if (error || !data) { setError('프로젝트 생성 실패'); setLoading(false); return }
    setProject(data)
    window.history.replaceState(null, '', `?code=${data.share_code}`)
    setLoading(false)
  }

  async function loadRooms(projectId: string) {
    const { data } = await supabase
      .from('rooms').select('*').eq('project_id', projectId).order('order_index')
    if (data) setRooms(data)
  }

  // Realtime subscriptions
  useEffect(() => {
    if (!project) return
    const channel = supabase.channel(`project-${project.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, payload => {
        if (payload.eventType === 'INSERT')
          setRooms(prev => [...prev, payload.new as Room])
        else if (payload.eventType === 'UPDATE')
          setRooms(prev => prev.map(r => r.id === (payload.new as Room).id ? payload.new as Room : r))
        else if (payload.eventType === 'DELETE')
          setRooms(prev => prev.filter(r => r.id !== (payload.old as Room).id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects' }, payload => {
        setProject(prev => prev ? { ...prev, ...payload.new } : prev)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [project])

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function addRoom(
    name: string,
    width_cm: number,
    height_cm: number,
    shape_data: ShapeData = { type: 'rect' },
    x_cm?: number,
    y_cm?: number,
  ) {
    if (!project) return
    snapshot()
    const color = COLORS[rooms.length % COLORS.length]
    const offset = rooms.length * 30
    await supabase.from('rooms').insert({
      project_id: project.id, name, width_cm, height_cm,
      x_cm: x_cm ?? Math.min(offset, project.apt_w - width_cm),
      y_cm: y_cm ?? Math.min(offset, project.apt_h - height_cm),
      color, order_index: rooms.length, shape_data,
    })
  }

  async function updateRoom(id: string, updates: Partial<Room>) {
    snapshot()
    await supabase.from('rooms').update(updates).eq('id', id)
  }

  async function deleteRoom(id: string) {
    snapshot()
    await supabase.from('rooms').delete().eq('id', id)
  }

  async function rotateRoom(id: string) {
    const room = rooms.find(r => r.id === id)
    if (!room || !project) return
    // Custom-drawn shapes (poly/polyline) keep their exact geometry; skip rotation
    if (room.shape_data?.type === 'poly' || room.shape_data?.type === 'polyline') return
    snapshot()
    const cx = room.x_cm + room.width_cm / 2
    const cy = room.y_cm + room.height_cm / 2
    const nw = room.height_cm
    const nh = room.width_cm
    const nx = Math.round(Math.max(0, Math.min(cx - nw / 2, project.apt_w - nw)) / 10) * 10
    const ny = Math.round(Math.max(0, Math.min(cy - nh / 2, project.apt_h - nh)) / 10) * 10
    // Rotate shape corner 90° CW: tl→tr→br→bl→tl, also swap cutout w/h
    const rotateCorner = (c: RoomCorner): RoomCorner =>
      ({ tl: 'tr', tr: 'br', br: 'bl', bl: 'tl' } as Record<RoomCorner, RoomCorner>)[c]
    const shape = room.shape_data ?? { type: 'rect' }
    const newShape: ShapeData = shape.type === 'L'
      ? { type: 'L', cutout_w: shape.cutout_h, cutout_h: shape.cutout_w, corner: rotateCorner(shape.corner) }
      : { type: 'rect' }
    await supabase.from('rooms').update({
      width_cm: nw, height_cm: nh, x_cm: nx, y_cm: ny, shape_data: newShape,
    }).eq('id', id)
  }

  async function updateApartment(apt_w: number, apt_h: number) {
    if (!project) return
    await supabase.from('projects').update({ apt_w, apt_h }).eq('id', project.id)
    setProject(prev => prev ? { ...prev, apt_w, apt_h } : prev)
  }

  return {
    project, rooms, loading, error,
    addRoom, updateRoom, deleteRoom, rotateRoom, updateApartment,
    undo, canUndo,
  }
}
