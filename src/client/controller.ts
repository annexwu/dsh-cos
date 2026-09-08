export interface CosStorageSnapshot {
  open: boolean
}

export class CosStorageController {
  private open = false
  private snapshot: CosStorageSnapshot = { open: false }
  private readonly listeners = new Set<() => void>()

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

  private setOpen(open: boolean): void {
    if (this.open === open) return
    this.open = open
    this.snapshot = { open }
    for (const listener of this.listeners) listener()
  }
}
