import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CosStorageController } from '../src/client/controller.ts'
import { mountStorageSidebarEntry, StorageSidebarAction } from '../src/client/sidebar.tsx'

const reactGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
let container: HTMLDivElement
let root: Root

beforeEach(() => {
  reactGlobal.IS_REACT_ACT_ENVIRONMENT = true
  document.documentElement.lang = 'zh-CN'
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
  document.documentElement.lang = ''
  delete reactGlobal.IS_REACT_ACT_ENVIRONMENT
})

describe('COS storage sidebar action', () => {
  it('uses the public sidebar slot component and toggles storage visibility', async () => {
    const controller = new CosStorageController()
    await act(async () => { root.render(<StorageSidebarAction controller={controller} wide />) })

    const entry = container.querySelector<HTMLButtonElement>('.dsh-cos-storage-entry')
    expect(entry?.textContent).toContain('COS 云存储')
    expect(entry?.getAttribute('aria-pressed')).toBe('false')

    await act(async () => { entry?.click() })
    expect(controller.getSnapshot().open).toBe(true)
    expect(entry?.dataset.active).toBe('true')
    expect(entry?.getAttribute('aria-pressed')).toBe('true')
  })

  it('renders a compact rail action without relying on sidebar DOM selectors', async () => {
    const controller = new CosStorageController()
    await act(async () => { root.render(<StorageSidebarAction controller={controller} wide={false} />) })

    const entry = container.querySelector<HTMLButtonElement>('.dsh-cos-storage-entry')
    expect(entry?.classList.contains('is-compact')).toBe(true)
    expect(entry?.textContent).toBe('')
    expect(entry?.getAttribute('aria-label')).toBe('COS 云存储')
  })

  it('places the storage entry below New Session instead of the sidebar footer', async () => {
    const sidebar = document.createElement('aside')
    sidebar.dataset.pane = 'sidebar'
    const sidebarRoot = document.createElement('div')
    const newSession = document.createElement('button')
    newSession.className = 'newSession'
    const workspaceRegion = document.createElement('div')
    workspaceRegion.className = 'regionArea'
    sidebarRoot.append(newSession, workspaceRegion)
    sidebar.appendChild(sidebarRoot)
    document.body.appendChild(sidebar)

    const controller = new CosStorageController()
    let dispose = (): void => {}
    await act(async () => { dispose = mountStorageSidebarEntry(controller) })

    const entry = sidebarRoot.querySelector<HTMLElement>('[data-dsh-cos-storage-entry]')
    expect(entry?.previousElementSibling).toBe(newSession)
    expect(entry?.nextElementSibling).toBe(workspaceRegion)

    await act(async () => { dispose() })
    sidebar.remove()
  })
})
