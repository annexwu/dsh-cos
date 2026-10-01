import { describe, expect, it, vi } from 'vitest'
import { bindStoragePanel, CosStorageController } from '../src/client/controller.ts'

describe('CosStorageController', () => {
  it('toggles, closes, and only publishes real state changes', () => {
    const controller = new CosStorageController()
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)

    expect(controller.getSnapshot()).toEqual({ open: false })
    controller.toggle()
    expect(controller.getSnapshot()).toEqual({ open: true })
    expect(listener).toHaveBeenCalledTimes(1)

    controller.close()
    controller.close()
    expect(controller.getSnapshot()).toEqual({ open: false })
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    controller.toggle()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('tracks native panel selection without navigating again', () => {
    let activePanelId: string | null = 'dsh-cos'
    const listeners = new Set<() => void>()
    const navigate = vi.fn()
    const controller = new CosStorageController(navigate)
    const dispose = bindStoragePanel(controller, {
      getSnapshot: () => ({ activePanelId }),
      subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    }, 'dsh-cos')

    expect(controller.getSnapshot().open).toBe(true)
    expect(navigate).not.toHaveBeenCalled()
    activePanelId = null
    for (const listener of listeners) listener()
    expect(controller.getSnapshot().open).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
    dispose()
    activePanelId = 'dsh-cos'
    for (const listener of listeners) listener()
    expect(controller.getSnapshot().open).toBe(false)
  })
})
