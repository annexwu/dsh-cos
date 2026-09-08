import React, { useSyncExternalStore } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { CosStoragePage } from './CosStoragePage.tsx'
import type { CosStorageItem } from '../protocol.ts'
import type { CosStorageController } from './controller.ts'

const CONVERSATION_COLUMN_SELECTOR = '[data-pane="conversation"], [class*="centerCol"]'
const SIDEBAR_NAVIGATION_SELECTOR = '[class*="sessionRow"], [class*="flatSessionRowWithoutStatus"], [class*="projectRow"], [class*="searchResultRow"], [class*="searchResultWorkspace"], [class*="newSession"]'

function conversationColumn(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>(CONVERSATION_COLUMN_SELECTOR) ?? undefined
}

export function StorageOverlay({
  controller,
  onStartConversation,
  onRequestDocumentPreview,
}: {
  controller: CosStorageController
  onStartConversation?: (item: CosStorageItem) => Promise<void>
  onRequestDocumentPreview?: (bucket: string) => Promise<void>
}): React.JSX.Element | null {
  const open = useSyncExternalStore(controller.subscribe, controller.getSnapshot).open
  if (!open) return null
  return (
    <div className="dsh-cos-storage-overlay" data-dsh-cos-storage-view="">
      <CosStoragePage
        controller={controller}
        onStartConversation={onStartConversation}
        onRequestDocumentPreview={onRequestDocumentPreview}
      />
    </div>
  )
}

export function mountStoragePanel(
  controller: CosStorageController,
  onStartConversation: (item: CosStorageItem) => Promise<void>,
  onRequestDocumentPreview: (bucket: string) => Promise<void>,
): () => void {
  let root: Root | undefined
  let container: HTMLDivElement | undefined

  const ensure = (): void => {
    const column = conversationColumn()
    if (column === undefined) return
    if (container?.parentElement === column) return
    root?.unmount()
    container?.remove()
    container = document.createElement('div')
    column.appendChild(container)
    root = createRoot(container)
    root.render(<StorageOverlay
      controller={controller}
      onStartConversation={onStartConversation}
      onRequestDocumentPreview={onRequestDocumentPreview}
    />)
  }

  const observer = new MutationObserver(ensure)
  const closeForSidebarNavigation = (event: MouseEvent): void => {
    if (!controller.getSnapshot().open) return
    const target = event.target
    if (target instanceof HTMLElement && target.closest(SIDEBAR_NAVIGATION_SELECTOR) !== null) controller.close()
  }
  observer.observe(document.body, { childList: true, subtree: true })
  document.addEventListener('pointerdown', closeForSidebarNavigation, true)
  document.addEventListener('click', closeForSidebarNavigation, true)
  ensure()

  return () => {
    observer.disconnect()
    document.removeEventListener('pointerdown', closeForSidebarNavigation, true)
    document.removeEventListener('click', closeForSidebarNavigation, true)
    root?.unmount()
    container?.remove()
  }
}
