export function snapToGrid(value: number, gridCm: number): number {
  return Math.round(value / gridCm) * gridCm
}
