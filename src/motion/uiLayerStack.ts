interface UiLayerEntry {
  id: symbol
  element: HTMLElement | null
}

const uiLayerStack: UiLayerEntry[] = []

export function addUiLayer(id: symbol, element: HTMLElement | null = null): void {
  uiLayerStack.push({ id, element })
}

export function removeUiLayer(id: symbol): void {
  const index = uiLayerStack.map((entry) => entry.id).lastIndexOf(id)
  if (index >= 0) {
    uiLayerStack.splice(index, 1)
  }
}

export function isTopUiLayer(id: symbol): boolean {
  return uiLayerStack[uiLayerStack.length - 1]?.id === id
}

export function getTopUiLayerElement(): HTMLElement | null {
  for (let index = uiLayerStack.length - 1; index >= 0; index -= 1) {
    const element = uiLayerStack[index]?.element
    if (element?.isConnected) {
      return element
    }
  }

  return null
}
