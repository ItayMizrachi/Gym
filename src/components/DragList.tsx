import { ReactNode } from 'react'
import { moved, useDragReorder } from './useDragReorder'

type ItemProps = ReturnType<ReturnType<typeof useDragReorder>['item']>

/** A list whose rows you press and hold, then drag into a new place. Spread `props` on each row's root element. */
export function DragList<T>({
  items,
  onReorder,
  className,
  children
}: {
  items: T[]
  onReorder: (next: T[]) => void
  className?: string
  children: (item: T, index: number, props: ItemProps, dragging: boolean) => ReactNode
}) {
  const d = useDragReorder((from, to) => onReorder(moved(items, from, to)))
  return <div className={`${className ?? ''}${d.dragging != null ? ' is-dragging' : ''}`}>{items.map((t, i) => children(t, i, d.item(i), d.dragging === i))}</div>
}
