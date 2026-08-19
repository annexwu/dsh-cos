import type { CosStorageController } from './controller.ts'
import { getCopy } from './copy.ts'

export const ENTRY_SELECTOR = '[data-dsh-cos-storage-entry]'

const ICON = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><path d="M5.15 15.1a3.55 3.55 0 0 1-.34-7.08A5.4 5.4 0 0 1 15.2 6.7a4.2 4.2 0 0 1-.38 8.4H5.15Z" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/></svg>'

function sidebarRoot(): HTMLElement | undefined {
  const column = document.querySelector<HTMLElement>('[data-pane="sidebar"], [class*="sidebarCol"]')
  if (column === null) return undefined
  const logoOwner = column.querySelector<HTMLElement>('[class*="logoRow"]')?.parentElement
  return logoOwner ?? (column.firstElementChild as HTMLElement | undefined)
}

function workspaceRegion(root: HTMLElement): HTMLElement | undefined {
  return Array.from(root.children).find(
    (child): child is HTMLElement => child instanceof HTMLElement && String(child.className).includes('regionArea'),
  )
}

function newSessionButton(root: HTMLElement): HTMLButtonElement | undefined {
  return root.querySelector<HTMLButtonElement>('button[class*="newSession"]') ?? undefined
}

function createEntry(controller: CosStorageController): HTMLButtonElement {
  const copy = getCopy()
  const entry = document.createElement('button')
  entry.type = 'button'
  entry.dataset.dshCosStorageEntry = ''
  entry.className = 'dsh-cos-storage-entry'
  entry.setAttribute('aria-label', copy.title)
  entry.setAttribute('title', copy.settingsDescription)

  const icon = document.createElement('span')
  icon.className = 'dsh-cos-storage-entry-icon'
  icon.innerHTML = ICON
  const label = document.createElement('span')
  label.className = 'dsh-cos-storage-entry-label'
  label.textContent = copy.title
  entry.append(icon, label)
  entry.addEventListener('click', () => { controller.toggle() })
  return entry
}

function placeEntry(root: HTMLElement, entry: HTMLButtonElement): boolean {
  const newSession = newSessionButton(root)
  if (newSession !== undefined) {
    if (entry.parentElement !== root || newSession.nextElementSibling !== entry) root.insertBefore(entry, newSession.nextElementSibling)
    return true
  }

  const region = workspaceRegion(root)
  if (region === undefined) return false
  if (entry.parentElement !== root || entry.nextElementSibling !== region) root.insertBefore(entry, region)
  return true
}

export function mountSidebarEntry(controller: CosStorageController): () => void {
  if (document.querySelector(ENTRY_SELECTOR) !== null) return () => {}

  const entry = createEntry(controller)
  let root: HTMLElement | undefined
  let placed = false

  const rootObserver = new MutationObserver(() => {
    if (root === undefined || !root.isConnected) {
      placed = false
      tryPlace()
      return
    }
    if (!root.contains(entry)) placed = placeEntry(root, entry)
  })

  const tryPlace = (): void => {
    if (root !== undefined && !root.isConnected) {
      rootObserver.disconnect()
      root = undefined
      placed = false
    }
    if (placed && document.body.contains(entry)) return
    root ??= sidebarRoot()
    if (root === undefined) return
    placed = placeEntry(root, entry)
    if (placed) rootObserver.observe(root, { childList: true, subtree: true })
  }

  const waitObserver = new MutationObserver(tryPlace)
  waitObserver.observe(document.body, { childList: true, subtree: true })

  const syncActive = (): void => {
    const open = controller.getSnapshot().open
    if (open) entry.dataset.active = 'true'
    else delete entry.dataset.active
    entry.setAttribute('aria-pressed', String(open))
  }
  const unsubscribe = controller.subscribe(syncActive)
  syncActive()
  tryPlace()

  return () => {
    waitObserver.disconnect()
    rootObserver.disconnect()
    unsubscribe()
    entry.remove()
  }
}
