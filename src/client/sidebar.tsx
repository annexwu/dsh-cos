import React, { useSyncExternalStore } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { CosStorageController } from './controller.ts'
import { getCopy } from './copy.ts'

function StorageIcon(): React.JSX.Element {
  return <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><path d="M5.15 15.1a3.55 3.55 0 0 1-.34-7.08A5.4 5.4 0 0 1 15.2 6.7a4.2 4.2 0 0 1-.38 8.4H5.15Z" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

export function StorageSidebarAction({ controller, wide }: { controller: CosStorageController; wide: boolean }): React.JSX.Element {
  const copy = getCopy()
  const open = useSyncExternalStore(controller.subscribe, controller.getSnapshot).open
  return (
    <button
      type="button"
      className={`dsh-cos-storage-entry${wide ? '' : ' is-compact'}`}
      data-active={open ? 'true' : undefined}
      aria-label={copy.title}
      aria-pressed={open}
      title={copy.settingsDescription}
      onClick={() => controller.toggle()}
    >
      <span className="dsh-cos-storage-entry-icon"><StorageIcon /></span>
      {wide && <span className="dsh-cos-storage-entry-label">{copy.title}</span>}
    </button>
  )
}

const ENTRY_SELECTOR = '[data-dsh-cos-storage-entry]'

function sidebarRoot(): HTMLElement | undefined {
  const column = document.querySelector<HTMLElement>('[data-pane="sidebar"], [class*="sidebarCol"]')
  if (column === null) return undefined
  const logoOwner = column.querySelector<HTMLElement>('[class*="logoRow"]')?.parentElement
  return logoOwner ?? (column.firstElementChild as HTMLElement | undefined)
}

function placeEntry(root: HTMLElement, entry: HTMLElement): boolean {
  const newSession = root.querySelector<HTMLButtonElement>('button[class*="newSession"]')
  if (newSession !== null && newSession.parentElement === root) {
    root.insertBefore(entry, newSession.nextElementSibling)
    return true
  }

  const workspaceRegion = Array.from(root.children).find(
    (child): child is HTMLElement => child instanceof HTMLElement && String(child.className).includes('regionArea'),
  )
  if (workspaceRegion === undefined) return false
  root.insertBefore(entry, workspaceRegion)
  return true
}

export function mountStorageSidebarEntry(controller: CosStorageController): () => void {
  if (document.querySelector(ENTRY_SELECTOR) !== null) return () => {}

  const entry = document.createElement('div')
  entry.dataset.dshCosStorageEntry = ''
  let reactRoot: Root | undefined
  let root: HTMLElement | undefined

  const render = (): void => {
    reactRoot ??= createRoot(entry)
    reactRoot.render(<StorageSidebarAction controller={controller} wide />)
  }
  const place = (): void => {
    if (entry.isConnected) return
    root = sidebarRoot()
    if (root === undefined || !placeEntry(root, entry)) return
    render()
  }
  const observer = new MutationObserver(place)
  observer.observe(document.body, { childList: true, subtree: true })
  place()

  return () => {
    observer.disconnect()
    reactRoot?.unmount()
    entry.remove()
  }
}
