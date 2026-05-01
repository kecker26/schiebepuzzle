export interface AppContextMenuRequest {
  clientX: number
  clientY: number
  target: EventTarget | null
  preventDefault?: () => void
}

export type AppContextMenuHandler = (request: AppContextMenuRequest) => void
