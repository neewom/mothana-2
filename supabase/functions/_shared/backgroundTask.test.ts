import { describe, expect, it, vi } from 'vitest'
import { scheduleBackgroundTask, type BackgroundTaskRuntime } from './backgroundTask'

describe('scheduleBackgroundTask', () => {
  it('enregistre une promesse en cours sans attendre sa résolution', async () => {
    let resolveTask: (() => void) | undefined
    const pendingTask = new Promise<void>((resolve) => {
      resolveTask = resolve
    })
    const runtime: BackgroundTaskRuntime = {
      waitUntil: vi.fn(),
    }

    scheduleBackgroundTask(runtime, () => pendingTask)

    expect(runtime.waitUntil).toHaveBeenCalledOnce()
    expect(runtime.waitUntil).toHaveBeenCalledWith(pendingTask)

    let completed = false
    void pendingTask.then(() => { completed = true })
    await Promise.resolve()
    expect(completed).toBe(false)

    resolveTask?.()
    await pendingTask
    expect(completed).toBe(true)
  })
})
