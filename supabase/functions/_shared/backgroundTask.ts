export interface BackgroundTaskRuntime {
  waitUntil(promise: Promise<unknown>): void
}

export function scheduleBackgroundTask(
  runtime: BackgroundTaskRuntime,
  task: () => Promise<unknown>,
): void {
  runtime.waitUntil(task())
}
