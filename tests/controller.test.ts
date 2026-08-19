import { describe, expect, it, vi } from 'vitest'
import { CosStorageController } from '../src/client/controller.ts'

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
})
