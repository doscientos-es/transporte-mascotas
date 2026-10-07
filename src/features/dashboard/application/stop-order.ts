export function moveItemAtInsertionIndex<Item>(
  items: Item[],
  sourceIndex: number,
  destinationIndex: number,
) {
  if (sourceIndex < 0 || sourceIndex >= items.length) return [...items]

  const reordered = [...items]
  const [moved] = reordered.splice(sourceIndex, 1)
  const insertionIndex = Math.max(
    0,
    Math.min(destinationIndex - Number(sourceIndex < destinationIndex), reordered.length),
  )
  reordered.splice(insertionIndex, 0, moved)
  return reordered
}
