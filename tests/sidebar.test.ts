import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CosStorageController } from '../src/client/controller.ts'
import { ENTRY_SELECTOR, mountSidebarEntry } from '../src/client/sidebar.ts'

describe('COS storage sidebar entry', () => {
  beforeEach(() => {
    document.documentElement.lang = 'zh-CN'
    document.body.innerHTML = `
      <aside data-pane="sidebar">
        <div class="shellRoot">
          <div class="logoRow"></div>
          <button class="newSession">新会话</button>
          <div class="regionArea">工作区</div>
        </div>
      </aside>
    `
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('mounts immediately after the new session button and toggles the panel', () => {
    const controller = new CosStorageController()
    const dispose = mountSidebarEntry(controller)
    const entry = document.querySelector<HTMLButtonElement>(ENTRY_SELECTOR)
    const newSession = document.querySelector('.newSession')

    expect(entry).not.toBeNull()
    expect(newSession?.nextElementSibling).toBe(entry)
    expect(entry?.textContent).toContain('COS 云存储')
    expect(entry?.getAttribute('aria-pressed')).toBe('false')

    entry?.click()
    expect(controller.getSnapshot().open).toBe(true)
    expect(entry?.dataset.active).toBe('true')
    expect(entry?.getAttribute('aria-pressed')).toBe('true')

    dispose()
    expect(document.querySelector(ENTRY_SELECTOR)).toBeNull()
  })

  it('re-inserts itself when a shell render removes the entry', async () => {
    const controller = new CosStorageController()
    const dispose = mountSidebarEntry(controller)
    document.querySelector(ENTRY_SELECTOR)?.remove()

    await new Promise(resolve => { setTimeout(resolve, 0) })

    const entry = document.querySelector(ENTRY_SELECTOR)
    expect(entry).not.toBeNull()
    expect(document.querySelector('.newSession')?.nextElementSibling).toBe(entry)
    dispose()
  })
})
