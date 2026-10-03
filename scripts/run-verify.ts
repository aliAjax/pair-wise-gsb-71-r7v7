// 测试入口：在 Node 中构造浏览器存储桩后执行场景验证
const storage = new Map<string, string>()
const localStorageStub = {
  getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
  setItem: (key: string, value: string) => storage.set(key, String(value)),
  removeItem: (key: string) => void storage.delete(key),
  clear: () => storage.clear(),
}
;(globalThis as any).localStorage = localStorageStub
;(globalThis as any).window = {
  setTimeout: (fn: () => void) => {
    fn()
    return 0
  },
}

const { runScenarios } = await import('./harness.ts')
const stats = runScenarios()
if (stats.fail > 0) process.exit(1)
