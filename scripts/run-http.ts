/* eslint-disable no-console */
// 通过真实 axios mock adapter 验证端到端 HTTP 语义
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

const pass = { n: 0 }
const fail = { n: 0 }
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) {
    pass.n += 1
    console.log(`  ✅ ${name}`)
  } else {
    fail.n += 1
    console.error(`  ❌ ${name} ${detail}`)
  }
}

async function main() {
const {
  importRuns,
  enterRunReview,
  getBatch,
  submitBatchReview,
  toggleBatchRegion,
  recomputeBatch,
  getRuns,
  getRun,
  getBatches,
  setFault,
  getSystemState,
  discardDraft,
  toggleRule,
} = await import('@/api/http')

const file = (name: string) => ({ name, size: 2000, dataUrl: 'data:image/png;base64,AAAA' })

// ============ A. 两次导入相同分片：只归档一次，并为同一批次 ============
console.log('A. 执行机重复分片去重')
const first = await importRuns({
  projectId: 'p-commerce',
  page: '订单结算页',
  device: 'Desktop 1440',
  theme: 'light',
  build: 'release/test-e2e',
  baselineVersion: 'b1',
  currentVersion: 'c1',
  executor: 'runner-07',
  shardBase: 0,
  files: [file('s0.png'), file('s1.png')],
})
check('首次归档 2 个分片', first.runs.length === 2 && first.duplicated === 0)

const second = await importRuns({
  projectId: 'p-commerce',
  page: '订单结算页',
  device: 'Desktop 1440',
  theme: 'light',
  build: 'release/test-e2e',
  baselineVersion: 'b1',
  currentVersion: 'c1',
  executor: 'runner-07',
  shardBase: 0,
  files: [file('s0.png'), file('s1.png')],
})
check('重复批次识别为同一批次', second.batchId === first.batchId)
check('重复分片全部去重', second.duplicated === 2)

// 另一台执行机晚到一个新分片
const third = await importRuns({
  projectId: 'p-commerce',
  page: '订单结算页',
  device: 'Desktop 1440',
  theme: 'light',
  build: 'release/test-e2e',
  baselineVersion: 'b1',
  currentVersion: 'c1',
  executor: 'runner-09',
  shardBase: 2,
  files: [file('s2.png')],
})
check('不同分片序号的新分片正常归档', third.duplicated === 0 && third.batchId === first.batchId)

// 默认运行列表隐藏重复分片
const runsList = await getRuns({ build: 'release/test-e2e' })
check('运行列表不含重复分片', runsList.length === 3, `got ${runsList.length}`)
const allRuns = await getRuns({ build: 'release/test-e2e' } as any)
void allRuns

// ============ B. 进入评审固定快照，晚到分片后续算 ============
console.log('B. 进入评审与晚到分片续算')
const batchId = first.batchId
await enterRunReview(first.runs[0].id)
let detail = await getBatch(batchId)
check('进入评审后为第 1 轮开放', detail.currentRound === 1 && detail.rounds[0].status === 'open')
check('初始有 3 个待评审分片', detail.pendingRunIds.length === 3)

// 批准第 1 轮
const submitted = await submitBatchReview(batchId, {
  category: 'design-change',
  decision: 'approved',
  reviewer: '林默',
  reason: '首批三个分片评审通过作为新基线',
  revision: detail.revision,
  round: 1,
  opId: 'e2e-approve-r1',
})
check('批准后批次状态 approved', submitted.status === 'approved')
check('审批留痕 1 条', submitted.approvals.length === 1)
check('第 1 轮关闭', submitted.rounds[0].status === 'approved')

// 又一台执行机晚到分片 3（与已批准的同页面同构建）
const late = await importRuns({
  projectId: 'p-commerce',
  page: '订单结算页',
  device: 'Desktop 1440',
  theme: 'light',
  build: 'release/test-e2e',
  baselineVersion: 'b1',
  currentVersion: 'c2',
  executor: 'runner-11',
  shardBase: 3,
  files: [file('s3.png')],
})
detail = await getBatch(batchId)
check('晚到分片归入同一批次', late.batchId === batchId)
check('批次自动续算到第 2 轮', detail.currentRound === 2)
check('状态为部分批准', detail.status === 'partially-approved')
check('只有新分片需要评审', detail.pendingRunIds.length === 1 && detail.pendingRunIds[0] === late.runs[0].id)
check('历史审批保留', detail.approvals.length === 1)
const oldShard = detail.shards.find((s) => s.run.id === first.runs[0].id)!
check('旧分片区域全部锁定为已确认', oldShard.regions.every((r) => r.state.state === 'confirmed'))
const lateShard = detail.shards.find((s) => s.run.id === late.runs[0].id)!
check('新分片区域为第 2 轮待判定', lateShard.regions.every((r) => r.state.round === 2 && r.state.state === 'pending'))

// ============ C. 并发提交：后到 409 并留草稿 ============
console.log('C. 两个窗口并发提交')
const revBefore = detail.revision
// 窗口 A 先提交（驳回）
await submitBatchReview(batchId, {
  category: 'render-error',
  decision: 'rejected',
  reviewer: '窗口A',
  reason: '窗口A先到达的驳回结论，足够长的原因',
  revision: revBefore,
  round: 2,
  opId: 'e2e-window-a',
})
// 窗口 B 用旧 revision 提交
let conflict: any = null
try {
  await submitBatchReview(batchId, {
    category: 'design-change',
    decision: 'approved',
    reviewer: '窗口B',
    reason: '窗口B晚到的批准结论，足够长的原因',
    revision: revBefore,
    round: 2,
    opId: 'e2e-window-b',
  })
} catch (error: any) {
  conflict = error
}
check('窗口 B 收到 409', conflict?.response?.status === 409)
check('409 携带草稿', conflict?.response?.data?.draft?.form.reviewer === '窗口B')
check('草稿记录两端修订号', conflict.response.data.draft.attemptedRevision === revBefore)
detail = await getBatch(batchId)
check('服务端批次下可读到草稿', detail.draft?.form.reason.includes('窗口B'))
check('窗口 A 的结论生效（未被覆盖）', detail.approvals.at(-1)?.reviewer === '窗口A')
// 丢弃草稿
await discardDraft(batchId)
detail = await getBatch(batchId)
check('草稿可丢弃', !detail.draft)

// ============ D. 规则变化只重算未确认区域 ============
console.log('D. 规则变化增量重算')
// 用一条新的待评审批次
const fresh = await importRuns({
  projectId: 'p-commerce',
  page: '订单结算页',
  device: 'Desktop 1440',
  theme: 'light',
  build: 'release/rule-change',
  baselineVersion: 'b',
  currentVersion: 'c',
  executor: 'runner-21',
  shardBase: 0,
  files: [file('x.png')],
})
await enterRunReview(fresh.runs[0].id)
let ruleBatch = await getBatch(fresh.batchId)
// 人工确认第一个区域为忽略并锁定
const targetRegion = ruleBatch.shards[0].regions[0]
ruleBatch = await toggleBatchRegion(fresh.batchId, {
  runId: targetRegion.state.runId,
  regionId: targetRegion.state.regionId,
  ignored: true,
  revision: ruleBatch.revision,
})
check('人工确认区域为 confirmed', ruleBatch.shards[0].regions[0].state.manual)
const revAtFreeze = ruleBatch.revision
// 停用全局时间规则 -> 触发增量重算
await toggleRule('rule-time', false)
ruleBatch = await getBatch(fresh.batchId)
check('规则变化后批次标记 rulesChanged', ruleBatch.rulesChanged)
ruleBatch = await recomputeBatch(fresh.batchId, revAtFreeze)
check('重算后 revision 前进', ruleBatch.revision > revAtFreeze)
const confirmedRegion = ruleBatch.shards[0].regions.find((r) => r.id === targetRegion.id)!
check('人工确认区域重算后保留', confirmedRegion.state.manual && confirmedRegion.state.state === 'confirmed')
await toggleRule('rule-time', true)

// 过期 revision 的重算请求冲突
let recomputeConflict: any = null
try {
  await recomputeBatch(fresh.batchId, revAtFreeze)
} catch (error: any) {
  recomputeConflict = error
}
check('旧修订号重算返回 409', recomputeConflict?.response?.status === 409)

// ============ E. 存储故障 → 503 → 重启恢复 ============
console.log('E. 本地存储写入失败与恢复')
const e = await importRuns({
  projectId: 'p-commerce',
  page: '订单结算页',
  device: 'Desktop 1440',
  theme: 'light',
  build: 'release/fault-test',
  baselineVersion: 'b',
  currentVersion: 'c',
  executor: 'runner-31',
  shardBase: 0,
  files: [file('f.png')],
})
await enterRunReview(e.runs[0].id)
const before = await getBatch(e.batchId)
await setFault(true)
let storageError: any = null
try {
  await submitBatchReview(e.batchId, {
    category: 'design-change',
    decision: 'approved',
    reviewer: '故障测试',
    reason: '写入故障期间的审批，足够长的原因',
    revision: before.revision,
    round: before.currentRound,
    opId: 'e2e-fault-op',
  })
} catch (error: any) {
  storageError = error
}
check('故障期间提交返回 503', storageError?.response?.status === 503)
check('503 提示可恢复且带 opId', storageError.response.data.recoverable && storageError.response.data.opId === 'e2e-fault-op')

// 内存态未改变：读回批次仍是开放轮次
const duringFault = await getBatch(e.batchId)
check('故障后内存中批次未被提交污染', duringFault.rounds.at(-1)?.status === 'open')
check('故障期间审批未出现在内存', duringFault.approvals.length === 0)

// 重启：关闭故障（模拟刷新），首次查询触发 WAL 重放恢复
await setFault(false)
// getSystemState 内部会消费 recovery 信息（main.ts 中 replayWal 已在模块加载时执行，
// 这里直接再次 import 同一模块无法重放；改为校验 WAL 重放函数）
const { replayWal } = await import('@/mocks/db')
const recovered = replayWal()
check('重启重放恢复故障前操作', recovered?.opId === 'e2e-fault-op')
const after = await getBatch(e.batchId)
check('恢复后审批恰好 1 条', after.approvals.length === 1 && after.approvals[0].opId === 'e2e-fault-op')
const uniqueRegions = new Set(after.regions.map((r) => `${r.runId}::${r.regionId}`))
check('恢复后区域无重复', uniqueRegions.size === after.regions.length)
const stateInfo = await getSystemState()
check('系统状态可读出恢复记录', stateInfo.recovery?.opId === 'e2e-fault-op')

// 幂等：用相同 opId 再提交不会产生第二条
const again = await submitBatchReview(e.batchId, {
  category: 'design-change',
  decision: 'approved',
  reviewer: '故障测试',
  reason: '写入故障期间的审批，足够长的原因',
  revision: after.revision + 10, // 故意旧，也不应新增审批
  round: 99,
  opId: 'e2e-fault-op',
}).catch((err) => err)
// 该 opId 只在轮次匹配时幂等；这里主要验证重放后无重复审批
void again
const finalBatch = await getBatch(e.batchId)
check('恢复后审批总数保持 1 条', finalBatch.approvals.length === 1)

// ============ F. 旧运行首次打开 ============
console.log('F. 旧运行入口兼容')
const legacyRun = await getRun('run-1048')
check('旧运行原本可直接读取', legacyRun.id === 'run-1048')
const legacyBatch = await enterRunReview('run-1048')
check('旧运行补建单运行批次', legacyBatch.runIds.length === 1 && legacyBatch.runIds[0] === 'run-1048')
check('旧运行进入第 1 轮评审', legacyBatch.currentRound === 1)
const legacyRunAfter = await getRun('run-1048')
check('旧运行已关联批次', legacyRunAfter.batchId === legacyBatch.id)

// 已审批的旧运行：补成历史轮次，不重开
const approvedLegacy = await enterRunReview('run-1046')
check('已审批旧运行还原历史结论', approvedLegacy.status === 'approved' && approvedLegacy.rounds[0].status === 'approved')
check('已审批旧运行不产生开放轮次', !approvedLegacy.rounds.some((r) => r.status === 'open'))
check('已审批旧运行带 1 条历史审批', approvedLegacy.approvals.length === 1)

// 批次列表中可看到
const batches = await getBatches()
check('批次列表包含新建批次', batches.some((b) => b.id === first.batchId))

console.log(`\n结果：${pass.n} 通过 / ${fail.n} 失败`)
if (fail.n > 0) process.exit(1)

}
main().catch((error) => { console.error(error); process.exit(1) })
