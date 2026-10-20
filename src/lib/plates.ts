/** Plate loading for a barbell: which plates go on each side. */
export interface PlateLoad {
  /** plates on ONE side, heaviest first */
  perSide: number[]
  /** total weight this loading gives (bar + both sides) */
  achieved: number
  /** true when `achieved` equals the requested weight */
  exact: boolean
}

const EPS = 1e-6
const r2 = (n: number) => Math.round(n * 1000) / 1000

/** Greedy fill of one side: biggest plate that still fits, repeated. Plates are assumed to come in unlimited pairs. */
function greedy(side: number, plates: number[]): number[] {
  const out: number[] = []
  let left = side
  for (const p of plates) {
    while (left >= p - EPS) {
      out.push(p)
      left = r2(left - p)
    }
  }
  return out
}

const sum = (xs: number[]) => r2(xs.reduce((a, b) => a + b, 0))

/**
 * Plates per side for `target` kg. When the target cannot be loaded exactly, returns the nearest
 * achievable loading (ties go to the lighter one).
 */
export function loadBar(target: number, bar: number, plates: number[]): PlateLoad {
  const sorted = [...new Set(plates.filter((p) => p > 0))].sort((a, b) => b - a)
  if (!(target > bar + EPS) || !sorted.length) {
    return { perSide: [], achieved: bar, exact: Math.abs(target - bar) < EPS }
  }
  const side = r2((target - bar) / 2)
  const below = greedy(side, sorted)
  const belowW = r2(bar + 2 * sum(below))
  if (Math.abs(belowW - target) < EPS) return { perSide: below, achieved: belowW, exact: true }

  // one step above: greedy for the side rounded up by the smallest plate
  const smallest = sorted[sorted.length - 1]
  const above = greedy(r2(sum(below) + smallest), sorted)
  const aboveW = r2(bar + 2 * sum(above))
  const pick = aboveW - target < target - belowW - EPS ? { perSide: above, achieved: aboveW } : { perSide: below, achieved: belowW }
  return { ...pick, exact: false }
}

/** Competition (IWF) plate colours; anything under 5 kg is grey. */
export function plateColor(kg: number): string {
  if (kg >= 25) return '#d8383a'
  if (kg >= 20) return '#2f6fd6'
  if (kg >= 15) return '#e8c12f'
  if (kg >= 10) return '#3aa05a'
  if (kg >= 5) return '#eeeeea'
  return '#8b8d93'
}
