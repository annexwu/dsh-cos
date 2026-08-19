import { createRoot, type Root } from 'react-dom/client'
import { CosStoragePage } from './CosStoragePage.tsx'
import type { CosStorageItem } from '../protocol.ts'
import type { CosStorageController } from './controller.ts'

export const VIEW_SELECTOR = '[data-dsh-cos-storage-view]'

const CONVERSATION_COLUMN_SELECTOR = '[data-pane="conversation"], [class*="centerCol"]'
const ACTIVE_ATTR = 'data-dsh-cos-storage-active'
const ACTIVATE_EVENT = 'dsh-panel-activate'
const PANEL_NAME = 'cos-storage'
const OPEN_TASKS_EVENT = 'dsh-cos:open-tasks'
const SHOW_TASK_DRAWER_EVENT = 'dsh-cos:show-task-drawer'
const SIDEBAR_ROW_SELECTOR = '[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], [class*="searchResultWorkspace"], [class*="newSession"]'

function conversationColumn(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>(CONVERSATION_COLUMN_SELECTOR) ?? undefined
}

export function mountPanel(controller: CosStorageController, onStartConversation?: (item: CosStorageItem) => Promise<void>): () => void {
  let root: Root | undefined
  let container: HTMLDivElement | undefined
  let announcingCompatibility = false

  const ensure = (): void => {
    if (container !== undefined) {
      if (container.isConnected) return
      root?.unmount()
      root = undefined
      container.remove()
      container = undefined
    }
    const column = conversationColumn()
    if (column === undefined) return
    container = document.createElement('div')
    container.dataset.dshCosStorageView = ''
    column.appendChild(container)
    root = createRoot(container)
    root.render(<CosStoragePage controller={controller} onStartConversation={onStartConversation} />)
  }

  const waitObserver = new MutationObserver(ensure)
  waitObserver.observe(document.body, { childList: true, subtree: true })

  const applyActive = (): void => {
    if (!controller.getSnapshot().open) {
      document.documentElement.removeAttribute(ACTIVE_ATTR)
      return
    }

    ensure()
    announcingCompatibility = true
    document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: 'ssh' }))
    document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: 'taskboard' }))
    announcingCompatibility = false
    document.documentElement.removeAttribute('data-dsh-ssh-active')
    document.documentElement.removeAttribute('data-dsh-taskboard-active')
    document.documentElement.setAttribute(ACTIVE_ATTR, '')
    document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: PANEL_NAME }))
  }

  const onOtherPanelActivate = (event: Event): void => {
    if (announcingCompatibility) return
    if ((event as CustomEvent<unknown>).detail !== PANEL_NAME && controller.getSnapshot().open) controller.close()
  }

  const onSidebarContextClick = (event: MouseEvent): void => {
    if (!controller.getSnapshot().open) return
    const target = event.target
    if (target instanceof HTMLElement && target.closest(SIDEBAR_ROW_SELECTOR) !== null) controller.close()
  }

  const onOpenTasks = (): void => {
    controller.show()
    ensure()
    window.setTimeout(() => document.dispatchEvent(new CustomEvent(SHOW_TASK_DRAWER_EVENT)), 0)
  }

  document.addEventListener(ACTIVATE_EVENT, onOtherPanelActivate)
  document.addEventListener(OPEN_TASKS_EVENT, onOpenTasks)
  document.addEventListener('click', onSidebarContextClick, true)
  const unsubscribe = controller.subscribe(applyActive)
  applyActive()
  ensure()

  return () => {
    document.removeEventListener(ACTIVATE_EVENT, onOtherPanelActivate)
    document.removeEventListener(OPEN_TASKS_EVENT, onOpenTasks)
    document.removeEventListener('click', onSidebarContextClick, true)
    waitObserver.disconnect()
    unsubscribe()
    document.documentElement.removeAttribute(ACTIVE_ATTR)
    root?.unmount()
    root = undefined
    container?.remove()
    container = undefined
  }
}
