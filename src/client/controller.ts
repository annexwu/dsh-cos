export interface CosStorageSnapshot {
  open: boolean
}

export function bindStoragePanel(
  controller: CosStorageController,
  panelInfo: { getSnapshot(): { activePanelId: string | null }; subscribe(listener: () => void): () => void },
  panelId: string,
): () => void {
  const syncPanel = () => controller.syncPanel(panelInfo.getSnapshot().activePanelId === panelId)
  const unsubscribe = panelInfo.subscribe(syncPanel)
  syncPanel()
  return unsubscribe
}

export class CosStorageController {
  private open = false
  private snapshot: CosStorageSnapshot = { open: false }
  private readonly listeners = new Set<() => void>()

  constructor(private readonly onNavigate?: (open: boolean) => void) {}

  readonly getSnapshot = (): CosStorageSnapshot => this.snapshot

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  toggle(): void {
    this.setOpen(!this.open)
  }

  show(): void {
    this.setOpen(true)
  }

  close(): void {
    this.setOpen(false)
  }

  syncPanel(open: boolean): void {
    this.setOpen(open, false)
  }

  private setOpen(open: boolean, navigate = true): void {
    if (this.open === open) return
    this.open = open
    this.snapshot = { open }
    if (navigate) this.onNavigate?.(open)
    for (const listener of this.listeners) listener()
  }
}
